import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  api,
  saveAuth,
  loadAuth,
  clearAuth,
  clearActiveOrderSnapshot,
  LoginResponse,
  ApiError,
  DriverRegistrationData,
} from '@/lib/api';

interface AuthUser {
  userId: number;
  driverId: number;
  role: string;
  name: string;
  email: string;
  phone: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerDriver: (data: DriverRegistrationData) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function isDriverRole(role: unknown): boolean {
  return typeof role === 'string' && role.trim().toLowerCase() === 'driver';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Counter to cancel in-flight login calls if a newer one starts
  const loginVersionRef = useRef(0);
  const sessionVersionRef = useRef(0);

  // Restore session on mount
  useEffect(() => {
    let cancelled = false;
    const restoreVersion = ++sessionVersionRef.current;
    (async () => {
      try {
        const saved = await loadAuth();
        if (cancelled) return;
        if (saved && sessionVersionRef.current === restoreVersion) {
          api.setToken(saved.token);
          try {
            // Verify token through the authenticated driver's own profile.
            const myDriver = await api.getCurrentDriver();
            if (cancelled || sessionVersionRef.current !== restoreVersion) return;
            if (myDriver && (!myDriver.userId || Number(myDriver.userId) === saved.userId)) {
              setUser({
                userId: saved.userId,
                driverId: myDriver.id,
                role: 'driver',
                name: myDriver.name,
                email: '',
                phone: myDriver.phone,
              });
            } else {
              // Valid token but no matching driver — clear auth
              await clearAuth();
              api.setToken(null);
            }
          } catch (err) {
            if (cancelled || sessionVersionRef.current !== restoreVersion) return;
            // Only clear stored credentials on an auth error (401/403).
            // Network failures or server errors should not log the driver out.
            const status = err instanceof ApiError ? err.status : 0;
            if (status === 401 || status === 403) {
              await clearAuth();
              api.setToken(null);
            }
            // Otherwise keep the token; the driver stays logged in and the
            // app will retry on the next action.
          }
        }
      } catch {
        // loadAuth itself failed (storage error) — proceed as unauthenticated
        if (!cancelled) {
          api.setToken(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // Bump version so any concurrent older request is ignored on completion
    const version = ++loginVersionRef.current;
    const sessionVersion = ++sessionVersionRef.current;

    await clearAuth();
    api.setToken(null);

    const res: LoginResponse = await api.login(email, password);

    if (!isDriverRole(res.user.role)) {
      api.setToken(null);
      throw new Error('Ce compte n’a pas le rôle livreur.');
    }

    // Set token immediately so authenticated requests (listDrivers) work
    if (sessionVersionRef.current !== sessionVersion) return;
    api.setToken(res.token);

    // Find the authenticated driver profile
    let myDriver;
    try {
      myDriver = await api.getCurrentDriver();
    } catch (err) {
      // If fetching drivers fails, clear token and re-throw
      if (sessionVersionRef.current === sessionVersion) api.setToken(null);
      throw err;
    }

    // If a newer login attempt started, discard this result
    if (
      loginVersionRef.current !== version ||
      sessionVersionRef.current !== sessionVersion
    ) return;

    if (!myDriver || (myDriver.userId && Number(myDriver.userId) !== res.user.id)) {
      await clearAuth();
      api.setToken(null);
      throw new Error("Aucun profil livreur trouvé pour ce compte.");
    }
    await saveAuth(res.token, res.user.id, myDriver.id);
    setUser({
      userId: res.user.id,
      driverId: myDriver.id,
      role: res.user.role,
      name: myDriver.name,
      email: res.user.email,
      phone: myDriver.phone,
    });
  }, []);

  const registerDriver = useCallback(async (data: DriverRegistrationData) => {
    const version = ++loginVersionRef.current;
    const sessionVersion = ++sessionVersionRef.current;

    await clearAuth();
    api.setToken(null);

    const res = await api.verifyAuthOtp({
      phone: data.phone,
      code: data.code,
      intent: 'signup',
      name: data.name,
      email: data.email,
      password: data.password,
      role: 'driver',
    });

    if (!isDriverRole(res.user.role)) {
      throw new Error('L’API n’a pas créé un compte avec le rôle driver.');
    }
    if (
      loginVersionRef.current !== version ||
      sessionVersionRef.current !== sessionVersion
    ) {
      return;
    }

    api.setToken(res.token);
    try {
      const myDriver = await api.getCurrentDriver();
      if (
        !myDriver ||
        (myDriver.userId && Number(myDriver.userId) !== Number(res.user.id))
      ) {
        throw new Error('Le profil driver distant n’a pas été créé pour ce compte.');
      }

      await api.completeDriverProfile(myDriver.id, {
        vehicleType: data.vehicleType,
        vehiclePlate: data.vehiclePlate,
        nationalId: data.nationalId,
        licenseNumber: data.licenseNumber?.trim() || undefined,
      });

      if (
        loginVersionRef.current !== version ||
        sessionVersionRef.current !== sessionVersion
      ) {
        return;
      }
      await saveAuth(res.token, res.user.id, myDriver.id);
      setUser({
        userId: res.user.id,
        driverId: myDriver.id,
        role: res.user.role,
        name: myDriver.name || res.user.name,
        email: res.user.email,
        phone: myDriver.phone || res.user.phone,
      });
    } catch (error) {
      api.setToken(null);
      await clearAuth();
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    sessionVersionRef.current += 1;
    loginVersionRef.current += 1;
    if (user?.driverId) {
      await clearActiveOrderSnapshot(user.driverId).catch(() => {});
    }
    await clearAuth();
    api.setToken(null);
    setUser(null);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, registerDriver, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

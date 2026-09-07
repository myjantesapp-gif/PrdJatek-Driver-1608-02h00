import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  api,
  saveAuth,
  loadAuth,
  clearAuth,
  clearActiveOrderSnapshot,
  LoginResponse,
  ApiError,
} from '@/lib/api';

interface AuthUser {
  userId: number;
  driverId: number;
  name: string;
  email: string;
  phone: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

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
      name: myDriver.name,
      email: res.user.email,
      phone: myDriver.phone,
    });
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
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

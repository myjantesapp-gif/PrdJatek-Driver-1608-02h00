import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, saveAuth, loadAuth, clearAuth, LoginResponse, ApiError } from '@/lib/api';

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

  // Restore session on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await loadAuth();
        if (cancelled) return;
        if (saved) {
          api.setToken(saved.token);
          try {
            // Verify token still valid by fetching driver profile
            const drivers = await api.listDrivers();
            if (cancelled) return;
            const myDriver = drivers.find((d) => d.userId === saved.userId);
            if (myDriver) {
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
            if (cancelled) return;
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

    await clearAuth();
    api.setToken(null);

    const res: LoginResponse = await api.login(email, password);

    // Find the driver record linked to this user
    const drivers = await api.listDrivers();

    // If a newer login attempt started, discard this result
    if (loginVersionRef.current !== version) return;

    const myDriver = drivers.find((d) => d.userId === res.user.id);
    if (!myDriver) {
      await clearAuth();
      api.setToken(null);
      throw new Error("Aucun profil livreur trouvé pour ce compte.");
    }

    api.setToken(res.token);
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
    await clearAuth();
    api.setToken(null);
    setUser(null);
  }, []);

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

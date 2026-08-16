import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, saveAuth, loadAuth, clearAuth, LoginResponse } from '@/lib/api';

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

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await loadAuth();
        if (saved) {
          api.setToken(saved.token);
          // Verify token still valid by fetching driver profile
          const drivers = await api.listDrivers();
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
            await clearAuth();
            api.setToken(null);
          }
        }
      } catch {
        await clearAuth();
        api.setToken(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // Remove any previous session before starting a new login attempt. This
    // prevents a failed login from restoring stale credentials on next launch.
    await clearAuth();
    api.setToken(null);

    const res: LoginResponse = await api.login(email, password);
    api.setToken(res.token);

    // Find the driver record linked to this user
    const drivers = await api.listDrivers();
    const myDriver = drivers.find((d) => d.userId === res.user.id);
    if (!myDriver) {
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

import { createContext, useCallback, useContext, useState } from 'react';
import { api, TOKEN_STORAGE_KEY } from '@/lib/api';

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  role: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  onPasswordChanged: (newToken: string) => void;
}

function decodeToken(token: string): { mustChangePassword?: boolean; role?: string } {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return {};
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY),
  );

  const decoded = token ? decodeToken(token) : {};
  const mustChangePassword = decoded.mustChangePassword ?? false;
  const role = decoded.role ?? null;

  const login = useCallback(async (identifier: string, password: string) => {
    const { accessToken } = await api.auth.login({ identifier, password });
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    setToken(accessToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
  }, []);

  const onPasswordChanged = useCallback((newToken: string) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setToken(newToken);
  }, []);

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: token !== null, mustChangePassword, role, login, logout, onPasswordChanged }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RelativeMe } from '@fonte/api-client';
import { api, setUnauthorizedHandler } from './api';
import { getApiErrorCode } from './errors';

const STORAGE_KEYS = ['token', 'relative'];

export class MustChangePasswordError extends Error {
  constructor() {
    super('MUST_CHANGE_PASSWORD');
    Object.setPrototypeOf(this, MustChangePasswordError.prototype);
  }
}

interface AuthState {
  token: string | null;
  relative: RelativeMe | null;
  isLoading: boolean;
  /** true quando a sessão caiu por 401 do backend (não por logout manual). */
  sessionExpired: boolean;
}

interface AuthContextValue extends AuthState {
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  refreshRelative: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    relative: null,
    isLoading: true,
    sessionExpired: false,
  });

  // Espelha o sessionExpired fora do ciclo de render: 401 concorrentes chegam antes
  // de qualquer re-render, então a idempotência precisa de uma ref.
  const sessionExpiredRef = useRef(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('token'),
      AsyncStorage.getItem('relative'),
    ])
      .then(([token, relativeJson]) => {
        setState({
          token,
          relative: relativeJson ? (JSON.parse(relativeJson) as RelativeMe) : null,
          isLoading: false,
          sessionExpired: false,
        });
      })
      .catch(() => {
        setState({ token: null, relative: null, isLoading: false, sessionExpired: false });
      });
  }, []);

  // 401 fora das rotas de auth = sessão morta: limpa storage + estado e marca a
  // expiração para o login exibir o aviso. O guard de (app) reage a token === null.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (sessionExpiredRef.current) return;
      sessionExpiredRef.current = true;
      void AsyncStorage.multiRemove(STORAGE_KEYS);
      setState({ token: null, relative: null, isLoading: false, sessionExpired: true });
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  async function login(identifier: string, password: string) {
    const { accessToken } = await api.auth.login({ identifier, password });
    await AsyncStorage.setItem('token', accessToken);
    sessionExpiredRef.current = false;

    try {
      const relative = await api.relatives.me();
      await AsyncStorage.setItem('relative', JSON.stringify(relative));
      setState({ token: accessToken, relative, isLoading: false, sessionExpired: false });
    } catch (err: unknown) {
      if (getApiErrorCode(err) === 'MUST_CHANGE_PASSWORD') {
        // Keep token in AsyncStorage so changePassword() can authenticate
        throw new MustChangePasswordError();
      }
      await AsyncStorage.removeItem('token');
      throw err;
    }
  }

  async function changePassword(newPassword: string) {
    const { accessToken } = await api.auth.changePassword({ newPassword });
    await AsyncStorage.setItem('token', accessToken);
    sessionExpiredRef.current = false;

    const relative = await api.relatives.me();
    await AsyncStorage.setItem('relative', JSON.stringify(relative));
    setState((s) => ({ ...s, token: accessToken, relative, sessionExpired: false }));
  }

  async function refreshRelative() {
    const relative = await api.relatives.me();
    await AsyncStorage.setItem('relative', JSON.stringify(relative));
    setState((s) => ({ ...s, relative }));
  }

  // Sair por vontade própria não é expiração: sessionExpired continua false.
  async function logout() {
    sessionExpiredRef.current = false;
    await AsyncStorage.multiRemove(STORAGE_KEYS);
    setState({ token: null, relative: null, isLoading: false, sessionExpired: false });
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout, changePassword, refreshRelative }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

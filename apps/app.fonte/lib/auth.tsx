import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RelativeMe } from '@fonte/api-client';
import { api } from './api';
import { getApiErrorCode } from './errors';

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
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    relative: null,
    isLoading: true,
  });

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
        });
      })
      .catch(() => {
        setState({ token: null, relative: null, isLoading: false });
      });
  }, []);

  async function login(email: string, password: string) {
    const { accessToken } = await api.auth.login({ email, password });
    await AsyncStorage.setItem('token', accessToken);

    try {
      const relative = await api.relatives.me();
      await AsyncStorage.setItem('relative', JSON.stringify(relative));
      setState({ token: accessToken, relative, isLoading: false });
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

    const relative = await api.relatives.me();
    await AsyncStorage.setItem('relative', JSON.stringify(relative));
    setState((s) => ({ ...s, token: accessToken, relative }));
  }

  async function logout() {
    await AsyncStorage.multiRemove(['token', 'relative']);
    setState({ token: null, relative: null, isLoading: false });
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

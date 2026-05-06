import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StaffMe } from '@fonte/api-client';
import { api } from './api';

export class MustChangePasswordError extends Error {
  constructor() {
    super('MUST_CHANGE_PASSWORD');
    Object.setPrototypeOf(this, MustChangePasswordError.prototype);
  }
}

interface AuthState {
  token: string | null;
  staff: StaffMe | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ token: null, staff: null, isLoading: true });

  useEffect(() => {
    Promise.all([AsyncStorage.getItem('token'), AsyncStorage.getItem('staff')])
      .then(([token, staffJson]) => {
        setState({
          token,
          staff: staffJson ? (JSON.parse(staffJson) as StaffMe) : null,
          isLoading: false,
        });
      })
      .catch(() => {
        setState({ token: null, staff: null, isLoading: false });
      });
  }, []);

  async function login(email: string, password: string) {
    const { accessToken } = await api.auth.login({ email, password });
    await AsyncStorage.setItem('token', accessToken);

    try {
      const staff = await api.staff.me();
      await AsyncStorage.setItem('staff', JSON.stringify(staff));
      setState({ token: accessToken, staff, isLoading: false });
    } catch (err: any) {
      if (err?.response?.data?.error === 'MUST_CHANGE_PASSWORD') {
        throw new MustChangePasswordError();
      }
      throw err;
    }
  }

  async function changePassword(newPassword: string) {
    const { accessToken } = await api.auth.changePassword({ newPassword });
    await AsyncStorage.setItem('token', accessToken);

    const staff = await api.staff.me();
    await AsyncStorage.setItem('staff', JSON.stringify(staff));
    setState({ token: accessToken, staff, isLoading: false });
  }

  async function logout() {
    await AsyncStorage.multiRemove(['token', 'staff']);
    setState({ token: null, staff: null, isLoading: false });
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

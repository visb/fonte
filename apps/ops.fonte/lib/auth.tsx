import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

export class MustChangePasswordError extends Error {
  constructor() {
    super('MUST_CHANGE_PASSWORD');
    Object.setPrototypeOf(this, MustChangePasswordError.prototype);
  }
}

interface StaffProfile {
  id: string;
  name: string;
  houseId: string;
  house: { id: string; name: string } | null;
}

interface AuthState {
  token: string | null;
  staff: StaffProfile | null;
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
    Promise.all([
      AsyncStorage.getItem('token'),
      AsyncStorage.getItem('staff'),
    ])
      .then(([token, staffJson]) => {
        setState({
          token,
          staff: staffJson ? (JSON.parse(staffJson) as StaffProfile) : null,
          isLoading: false,
        });
      })
      .catch(() => {
        setState({ token: null, staff: null, isLoading: false });
      });
  }, []);

  async function login(email: string, password: string) {
    const { data } = await api.post<{ accessToken: string }>('/auth/login', { email, password });
    await AsyncStorage.setItem('token', data.accessToken);

    try {
      const { data: staff } = await api.get<StaffProfile>('/staff/me');
      await AsyncStorage.setItem('staff', JSON.stringify(staff));
      setState({ token: data.accessToken, staff, isLoading: false });
    } catch (err: any) {
      if (err?.response?.data?.error === 'MUST_CHANGE_PASSWORD') {
        throw new MustChangePasswordError();
      }
      throw err;
    }
  }

  async function changePassword(newPassword: string) {
    const { data } = await api.post<{ accessToken: string }>('/auth/change-password', { newPassword });
    await AsyncStorage.setItem('token', data.accessToken);

    const { data: staff } = await api.get<StaffProfile>('/staff/me');
    await AsyncStorage.setItem('staff', JSON.stringify(staff));
    setState({ token: data.accessToken, staff, isLoading: false });
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

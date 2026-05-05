import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

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
    const { data } = await api.post<{ access_token: string }>('/auth/login', { email, password });
    await AsyncStorage.setItem('token', data.access_token);

    const { data: staff } = await api.get<StaffProfile>('/staff/me', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    await AsyncStorage.setItem('staff', JSON.stringify(staff));

    setState({ token: data.access_token, staff, isLoading: false });
  }

  async function logout() {
    await AsyncStorage.multiRemove(['token', 'staff']);
    setState({ token: null, staff: null, isLoading: false });
  }

  return <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

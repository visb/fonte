import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ResidentMe, StaffMe } from '@fonte/api-client';
import { ProfileType, StaffPermissionType } from '@fonte/types';
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
  resident: ResidentMe | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  isResident: boolean;
  canSendMessagesToFamilies: boolean;
  canModerateMessages: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  refreshStaff: () => Promise<void>;
  refreshResident: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    staff: null,
    resident: null,
    isLoading: true,
  });

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('token'),
      AsyncStorage.getItem('staff'),
      AsyncStorage.getItem('resident'),
    ])
      .then(([token, staffJson, residentJson]) => {
        setState({
          token,
          staff: staffJson ? (JSON.parse(staffJson) as StaffMe) : null,
          resident: residentJson ? (JSON.parse(residentJson) as ResidentMe) : null,
          isLoading: false,
        });
      })
      .catch(() => {
        setState({ token: null, staff: null, resident: null, isLoading: false });
      });
  }, []);

  async function login(identifier: string, password: string) {
    const { accessToken, profileType } = await api.auth.login({ identifier, password });
    await AsyncStorage.setItem('token', accessToken);

    try {
      if (profileType === ProfileType.RESIDENT) {
        const resident = await api.residents.me();
        await AsyncStorage.setItem('resident', JSON.stringify(resident));
        await AsyncStorage.removeItem('staff');
        setState({ token: accessToken, staff: null, resident, isLoading: false });
      } else {
        const staff = await api.staff.me();
        await AsyncStorage.setItem('staff', JSON.stringify(staff));
        await AsyncStorage.removeItem('resident');
        setState({ token: accessToken, staff, resident: null, isLoading: false });
      }
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { error?: string } } };
      if (anyErr?.response?.data?.error === 'MUST_CHANGE_PASSWORD') {
        throw new MustChangePasswordError();
      }
      throw err;
    }
  }

  async function changePassword(newPassword: string) {
    const { accessToken, profileType } = await api.auth.changePassword({ newPassword });
    await AsyncStorage.setItem('token', accessToken);

    if (profileType === ProfileType.RESIDENT) {
      const resident = await api.residents.me();
      await AsyncStorage.setItem('resident', JSON.stringify(resident));
      setState((s) => ({ ...s, token: accessToken, resident, isLoading: false }));
    } else {
      const staff = await api.staff.me();
      await AsyncStorage.setItem('staff', JSON.stringify(staff));
      setState((s) => ({ ...s, token: accessToken, staff, isLoading: false }));
    }
  }

  async function refreshStaff() {
    const updated = await api.staff.me();
    await AsyncStorage.setItem('staff', JSON.stringify(updated));
    setState((s) => ({ ...s, staff: updated }));
  }

  async function refreshResident() {
    const updated = await api.residents.me();
    await AsyncStorage.setItem('resident', JSON.stringify(updated));
    setState((s) => ({ ...s, resident: updated }));
  }

  async function logout() {
    await AsyncStorage.multiRemove(['token', 'staff', 'resident']);
    setState({ token: null, staff: null, resident: null, isLoading: false });
  }

  return (
    <AuthContext.Provider
      value={{
        ...state,
        isResident: !!state.resident && !state.staff,
        canSendMessagesToFamilies: !!state.staff?.permissions?.includes(StaffPermissionType.SEND_MESSAGES_TO_FAMILIES),
        canModerateMessages: !!state.staff?.permissions?.includes(StaffPermissionType.MODERATE_MESSAGES),
        login,
        logout,
        changePassword,
        refreshStaff,
        refreshResident,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

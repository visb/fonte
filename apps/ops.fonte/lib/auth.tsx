import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ResidentMe, StaffMe } from '@fonte/api-client';
import { ProfileType, StaffPermissionType } from '@fonte/types';
import { api, setUnauthorizedHandler } from './api';
import { queryClient } from './queryClient';
import { clearPersistedCache } from './offline/persister';

const STORAGE_KEYS = ['token', 'staff', 'resident'];

/**
 * Fim de sessão = fim do dado no dispositivo. O cache persistido guarda dado
 * pessoal de filho (LGPD, epic 167), então sai junto com as chaves de auth.
 * Limpar o `queryClient` antes garante que uma gravação throttled pendente
 * escreva um cache vazio, não o antigo.
 */
async function clearSessionData(): Promise<void> {
  await AsyncStorage.multiRemove(STORAGE_KEYS);
  queryClient.clear();
  await clearPersistedCache();
}

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
  /** true quando a sessão caiu por 401 do backend (não por logout manual). */
  sessionExpired: boolean;
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
    sessionExpired: false,
  });

  // Espelha o sessionExpired fora do ciclo de render: 401 concorrentes chegam antes
  // de qualquer re-render, então a idempotência precisa de uma ref.
  const sessionExpiredRef = useRef(false);

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
          sessionExpired: false,
        });
      })
      .catch(() => {
        setState({
          token: null,
          staff: null,
          resident: null,
          isLoading: false,
          sessionExpired: false,
        });
      });
  }, []);

  // 401 fora das rotas de auth = sessão morta: limpa storage + estado e marca a
  // expiração para o login exibir o aviso. O guard de (app) reage a token === null.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (sessionExpiredRef.current) return;
      sessionExpiredRef.current = true;
      void clearSessionData();
      setState({
        token: null,
        staff: null,
        resident: null,
        isLoading: false,
        sessionExpired: true,
      });
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  async function login(identifier: string, password: string) {
    const { accessToken, profileType } = await api.auth.login({ identifier, password });
    await AsyncStorage.setItem('token', accessToken);
    sessionExpiredRef.current = false;

    try {
      if (profileType === ProfileType.RESIDENT) {
        const resident = await api.residents.me();
        await AsyncStorage.setItem('resident', JSON.stringify(resident));
        await AsyncStorage.removeItem('staff');
        setState({
          token: accessToken,
          staff: null,
          resident,
          isLoading: false,
          sessionExpired: false,
        });
      } else {
        const staff = await api.staff.me();
        await AsyncStorage.setItem('staff', JSON.stringify(staff));
        await AsyncStorage.removeItem('resident');
        setState({
          token: accessToken,
          staff,
          resident: null,
          isLoading: false,
          sessionExpired: false,
        });
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
    sessionExpiredRef.current = false;

    if (profileType === ProfileType.RESIDENT) {
      const resident = await api.residents.me();
      await AsyncStorage.setItem('resident', JSON.stringify(resident));
      setState((s) => ({
        ...s,
        token: accessToken,
        resident,
        isLoading: false,
        sessionExpired: false,
      }));
    } else {
      const staff = await api.staff.me();
      await AsyncStorage.setItem('staff', JSON.stringify(staff));
      setState((s) => ({
        ...s,
        token: accessToken,
        staff,
        isLoading: false,
        sessionExpired: false,
      }));
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

  // Sair por vontade própria não é expiração: sessionExpired continua false.
  async function logout() {
    sessionExpiredRef.current = false;
    await clearSessionData();
    setState({
      token: null,
      staff: null,
      resident: null,
      isLoading: false,
      sessionExpired: false,
    });
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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

const login = vi.fn();

vi.mock('@/lib/api', () => ({
  TOKEN_STORAGE_KEY: 'fonte_token',
  api: { auth: { login: (...a: unknown[]) => login(...a) } },
}));

import { AuthProvider, useAuth } from './AuthContext';

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

/** Monta um JWT fake com o payload informado (sem assinatura real). */
const jwt = (payload: Record<string, unknown>) =>
  `h.${btoa(JSON.stringify(payload))}.s`;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
afterEach(() => cleanup());

describe('AuthContext', () => {
  it('estado inicial sem token', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.role).toBeNull();
    expect(result.current.userId).toBeNull();
    expect(result.current.mustChangePassword).toBe(false);
  });

  it('hidrata do localStorage e decodifica role/sub/mustChangePassword', () => {
    localStorage.setItem('fonte_token', jwt({ role: 'ADMIN', sub: 'u1', mustChangePassword: true }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.role).toBe('ADMIN');
    expect(result.current.userId).toBe('u1');
    expect(result.current.mustChangePassword).toBe(true);
  });

  it('token inválido decodifica para vazio (catch)', () => {
    localStorage.setItem('fonte_token', 'nao-e-jwt');
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.role).toBeNull();
    expect(result.current.userId).toBeNull();
  });

  it('login guarda o token e autentica', async () => {
    login.mockResolvedValue({ accessToken: jwt({ role: 'SERVANT', sub: 'u9' }) });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login('user', 'pass');
    });
    expect(login).toHaveBeenCalledWith({ identifier: 'user', password: 'pass' });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.role).toBe('SERVANT');
    expect(localStorage.getItem('fonte_token')).not.toBeNull();
  });

  it('logout limpa token e storage', () => {
    localStorage.setItem('fonte_token', jwt({ role: 'ADMIN', sub: 'u1' }));
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.logout());
    expect(result.current.token).toBeNull();
    expect(localStorage.getItem('fonte_token')).toBeNull();
  });

  it('onPasswordChanged troca o token', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.onPasswordChanged(jwt({ role: 'ADMIN', sub: 'u2', mustChangePassword: false })));
    expect(result.current.role).toBe('ADMIN');
    expect(result.current.mustChangePassword).toBe(false);
  });

  it('useAuth fora do provider lança', () => {
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
  });
});

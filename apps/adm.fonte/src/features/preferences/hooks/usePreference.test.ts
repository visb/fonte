import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

const set = vi.fn(() => Promise.resolve());
vi.mock('@/lib/api', () => ({
  api: { preferences: { set: (...a: unknown[]) => set(...a) } },
}));

import { usePreference } from './usePreference';
import { readPreference, writePreferences } from '@/lib/preferences';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  cleanup();
});

describe('usePreference', () => {
  it('lê do cache no primeiro render', () => {
    writePreferences({ 'x.k': { a: 1 } });
    const { result } = renderHook(() => usePreference('x.k', null));
    expect(result.current[0]).toEqual({ a: 1 });
  });

  it('cai no default quando não há cache', () => {
    const { result } = renderHook(() => usePreference('x.k', 'padrao'));
    expect(result.current[0]).toBe('padrao');
  });

  it('setValue grava no cache na hora e persiste na API com debounce', () => {
    const { result } = renderHook(() => usePreference('x.k', null));

    act(() => result.current[1]({ status: 'ACTIVE' }));

    // Cache: imediato e síncrono.
    expect(readPreference('x.k', null)).toEqual({ status: 'ACTIVE' });
    // API: só depois do debounce.
    expect(set).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(500));
    expect(set).toHaveBeenCalledWith('x.k', { status: 'ACTIVE' });
  });

  it('mudanças rápidas colapsam numa só chamada de API (debounce)', () => {
    const { result } = renderHook(() => usePreference('x.k', null));

    act(() => {
      result.current[1]({ n: 1 });
      result.current[1]({ n: 2 });
      result.current[1]({ n: 3 });
    });
    act(() => vi.advanceTimersByTime(500));

    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith('x.k', { n: 3 });
    // O estado exposto acompanha o último valor.
    expect(result.current[0]).toEqual({ n: 3 });
  });

  it('erro ao persistir não estoura (best-effort)', () => {
    set.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => usePreference('x.k', null));
    act(() => result.current[1]({ n: 1 }));
    expect(() => act(() => vi.advanceTimersByTime(500))).not.toThrow();
  });
});

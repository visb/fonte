import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

// Preferência mockada (story 130): controlamos o valor salvo e espionamos a
// gravação, sem tocar localStorage nem rede.
const { setPreferenceValue, prefState } = vi.hoisted(() => ({
  setPreferenceValue: vi.fn(),
  prefState: { saved: null as unknown, key: '' },
}));
vi.mock('@/features/preferences/hooks/usePreference', () => ({
  usePreference: (key: string) => {
    prefState.key = key;
    return [prefState.saved, setPreferenceValue];
  },
}));

import { STAFF_SEARCH_DEBOUNCE_MS, useStaffFiltersUrl } from './useStaffFiltersUrl';

function setup(url = '/staff', canFilterHouse = true, strict = false) {
  const wrapper = ({ children }: { children: ReactNode }) => {
    const router = <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
    return strict ? <StrictMode>{router}</StrictMode> : router;
  };
  return renderHook(
    () => ({ filters: useStaffFiltersUrl({ canFilterHouse }), location: useLocation() }),
    { wrapper },
  );
}

const params = (result: { current: { location: { search: string } } }) =>
  Object.fromEntries(new URLSearchParams(result.current.location.search));

beforeEach(() => {
  vi.clearAllMocks();
  prefState.saved = null;
});
afterEach(() => vi.useRealTimers());

describe('useStaffFiltersUrl (story 223)', () => {
  it('usa a chave staff.filters e lê q/status/house da URL', () => {
    const { result } = setup('/staff?q=ana&status=dismissed&house=h1');
    expect(prefState.key).toBe('staff.filters');
    expect(result.current.filters).toMatchObject({
      search: 'ana',
      debouncedSearch: 'ana',
      status: 'dismissed',
      houseId: 'h1',
      isFiltering: true,
    });
  });

  it('defaults: status active, sem casa, sem busca', () => {
    const { result } = setup();
    expect(result.current.filters).toMatchObject({
      search: '',
      status: 'active',
      houseId: '',
      isFiltering: false,
    });
  });

  it('status inválido na URL vira active', () => {
    const { result } = setup('/staff?status=nope');
    expect(result.current.filters.status).toBe('active');
  });

  it('mudança de status grava na URL (replace) e persiste { status, house } sem q', () => {
    const { result } = setup('/staff?q=ana&house=h1');
    act(() => result.current.filters.setStatus('dismissed'));
    expect(params(result)).toEqual({ q: 'ana', house: 'h1', status: 'dismissed' });
    expect(setPreferenceValue).toHaveBeenLastCalledWith({ status: 'dismissed', house: 'h1' });

    act(() => result.current.filters.setStatus('active'));
    expect(params(result)).toEqual({ q: 'ana', house: 'h1' });
    expect(setPreferenceValue).toHaveBeenLastCalledWith({ status: 'active', house: 'h1' });
  });

  it('mudança de casa grava na URL e persiste; vazio remove o param', () => {
    const { result } = setup('/staff?status=dismissed');
    act(() => result.current.filters.setHouseId('h2'));
    expect(params(result)).toEqual({ status: 'dismissed', house: 'h2' });
    expect(setPreferenceValue).toHaveBeenLastCalledWith({ status: 'dismissed', house: 'h2' });

    act(() => result.current.filters.setHouseId(''));
    expect(params(result)).toEqual({ status: 'dismissed' });
    expect(setPreferenceValue).toHaveBeenLastCalledWith({ status: 'dismissed', house: '' });
  });

  it('busca vai à URL só após o debounce; limpar remove o q', () => {
    vi.useFakeTimers();
    const { result } = setup();
    act(() => result.current.filters.setSearch('joão'));
    expect(result.current.filters.search).toBe('joão');
    expect(params(result)).toEqual({});

    act(() => vi.advanceTimersByTime(STAFF_SEARCH_DEBOUNCE_MS));
    expect(params(result)).toEqual({ q: 'joão' });
    expect(result.current.filters.debouncedSearch).toBe('joão');
    expect(result.current.filters.isFiltering).toBe(true);

    act(() => result.current.filters.setSearch(''));
    act(() => vi.advanceTimersByTime(STAFF_SEARCH_DEBOUNCE_MS));
    expect(params(result)).toEqual({});
    expect(setPreferenceValue).not.toHaveBeenCalled();
  });

  it('URL vazia + preferência → hidrata status e casa, sem gravar a preferência', () => {
    prefState.saved = { status: 'dismissed', house: 'h1' };
    const { result } = setup();
    expect(params(result)).toEqual({ status: 'dismissed', house: 'h1' });
    expect(result.current.filters).toMatchObject({ status: 'dismissed', houseId: 'h1' });
    expect(setPreferenceValue).not.toHaveBeenCalled();
  });

  it('hidratação sobrevive ao duplo-mount do StrictMode', () => {
    prefState.saved = { status: 'dismissed', house: 'h1' };
    const { result } = setup('/staff', true, true);
    expect(params(result)).toEqual({ status: 'dismissed', house: 'h1' });
  });

  it('hidratação mantém o q da URL (q não bloqueia nem é persistido)', () => {
    prefState.saved = { status: 'active', house: 'h1' };
    const { result } = setup('/staff?q=ana');
    expect(params(result)).toEqual({ q: 'ana', house: 'h1' });
  });

  it('preferência só com defaults não navega', () => {
    prefState.saved = { status: 'active', house: '' };
    const { result } = setup();
    expect(params(result)).toEqual({});
  });

  it('URL com qualquer filtro persistido ignora a preferência', () => {
    prefState.saved = { status: 'dismissed', house: 'h1' };
    const withHouse = setup('/staff?house=h2');
    expect(params(withHouse.result)).toEqual({ house: 'h2' });

    const withStatus = setup('/staff?status=active');
    expect(params(withStatus.result)).toEqual({ status: 'active' });
  });

  it('sem permissão de casa: house da URL e da preferência são ignorados e setHouseId é no-op', () => {
    prefState.saved = { status: 'active', house: 'h1' };
    const { result } = setup('/staff', false);
    expect(params(result)).toEqual({});
    expect(result.current.filters.houseId).toBe('');

    const fromUrl = setup('/staff?house=h9', false);
    expect(fromUrl.result.current.filters.houseId).toBe('');
    act(() => fromUrl.result.current.filters.setHouseId('h2'));
    expect(params(fromUrl.result)).toEqual({ house: 'h9' });
    expect(setPreferenceValue).not.toHaveBeenCalled();

    act(() => fromUrl.result.current.filters.setStatus('dismissed'));
    expect(setPreferenceValue).toHaveBeenLastCalledWith({ status: 'dismissed', house: '' });
  });

  it('sem permissão de casa: preferência dismissed ainda hidrata o status', () => {
    prefState.saved = { status: 'dismissed', house: 'h1' };
    const { result } = setup('/staff', false);
    expect(params(result)).toEqual({ status: 'dismissed' });
  });
});

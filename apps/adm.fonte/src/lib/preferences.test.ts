import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearPreferences,
  readPreference,
  readPreferences,
  writePreferenceCache,
  writePreferences,
} from './preferences';

const KEY = 'fonte.preferences';

beforeEach(() => {
  localStorage.clear();
});

describe('readPreferences', () => {
  it('devolve {} quando não há cache', () => {
    expect(readPreferences()).toEqual({});
  });

  it('parseia um mapa válido', () => {
    localStorage.setItem(KEY, JSON.stringify({ 'residents.filters': { status: '' } }));
    expect(readPreferences()).toEqual({ 'residents.filters': { status: '' } });
  });

  it('devolve {} quando o JSON está corrompido (não quebra a tela)', () => {
    localStorage.setItem(KEY, '{nao-e-json');
    expect(readPreferences()).toEqual({});
  });

  it('devolve {} quando o cache não é objeto (array/primitivo)', () => {
    localStorage.setItem(KEY, JSON.stringify(['x']));
    expect(readPreferences()).toEqual({});
    localStorage.setItem(KEY, JSON.stringify(42));
    expect(readPreferences()).toEqual({});
    localStorage.setItem(KEY, JSON.stringify(null));
    expect(readPreferences()).toEqual({});
  });
});

describe('readPreference', () => {
  it('devolve o valor da chave quando existe', () => {
    writePreferences({ 'residents.filters': { status: 'ACTIVE' } });
    expect(readPreference('residents.filters', null)).toEqual({ status: 'ACTIVE' });
  });

  it('devolve o default quando a chave não existe', () => {
    expect(readPreference('inexistente', { fallback: true })).toEqual({ fallback: true });
  });

  it('devolve o default quando o cache está corrompido', () => {
    localStorage.setItem(KEY, 'lixo');
    expect(readPreference('residents.filters', 'padrao')).toBe('padrao');
  });

  it('preserva valores falsy salvos (não confunde com ausência)', () => {
    writePreferences({ 'x.flag': '' });
    expect(readPreference('x.flag', 'default')).toBe('');
  });
});

describe('writePreferenceCache', () => {
  it('grava uma chave preservando as demais', () => {
    writePreferences({ a: 1, b: 2 });
    writePreferenceCache('b', 99);
    expect(readPreferences()).toEqual({ a: 1, b: 99 });
  });

  it('cria o cache quando ainda não existe', () => {
    writePreferenceCache('novo', { ok: true });
    expect(readPreference('novo', null)).toEqual({ ok: true });
  });
});

describe('clearPreferences', () => {
  it('remove todo o cache', () => {
    writePreferences({ a: 1 });
    clearPreferences();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(readPreferences()).toEqual({});
  });
});

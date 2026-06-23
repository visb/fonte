import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { relativeTime } from './relativeTime';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

describe('relativeTime', () => {
  it('< 1 min → "agora"', () => {
    expect(relativeTime(ago(30 * 1000))).toBe('agora');
  });

  it('minutos', () => {
    expect(relativeTime(ago(5 * 60 * 1000))).toBe('5 min');
  });

  it('horas', () => {
    expect(relativeTime(ago(2 * 60 * 60 * 1000))).toBe('2 h');
  });

  it('dias', () => {
    expect(relativeTime(ago(3 * 24 * 60 * 60 * 1000))).toBe('3 d');
  });

  it('> 30 dias → data pt-BR', () => {
    const out = relativeTime(ago(40 * 24 * 60 * 60 * 1000));
    expect(out).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('futuro não fica negativo (clampa em "agora")', () => {
    expect(relativeTime(new Date(Date.now() + 60_000).toISOString())).toBe('agora');
  });
});

import { describe, expect, it } from 'vitest';
import type { ObservabilityRouteStats } from '@fonte/api-client';
import {
  EMPTY_VALUE,
  formatDateTime,
  formatKb,
  formatMb,
  formatMs,
  formatNumber,
  formatPercent,
  formatTime,
  formatUptime,
  isErrorStatus,
  isNPlusOneSuspect,
  isSlowRoute,
  sortRoutes,
} from './utils';

function route(overrides: Partial<ObservabilityRouteStats> = {}): ObservabilityRouteStats {
  return {
    route: 'GET /api/v1/residents',
    count: 10,
    errors: 0,
    avgDurationMs: 100,
    maxDurationMs: 300,
    p50DurationMs: 80,
    p95DurationMs: 250,
    avgCpuMs: 12,
    avgDbQueries: 5,
    avgDbMs: 30,
    avgHeapDeltaKb: 100,
    lastAt: '2026-08-30T12:00:00.000Z',
    ...overrides,
  };
}

describe('formatadores', () => {
  it('formata zero sem virar vazio', () => {
    expect(formatMs(0)).toBe('0.0 ms');
    expect(formatMb(0)).toBe('0.0 MB');
    expect(formatPercent(0)).toBe('0.0%');
    expect(formatNumber(0)).toBe('0.0');
    expect(formatKb(0)).toBe('0 kB');
  });

  it('formata valor grande', () => {
    expect(formatMs(12345.678)).toBe('12345.7 ms');
    expect(formatMb(2048.44)).toBe('2048.4 MB');
    expect(formatPercent(99.99)).toBe('100.0%');
    expect(formatNumber(1234.56, 2)).toBe('1234.56');
    expect(formatKb(-512.4)).toBe('-512 kB');
  });

  // O backend pode devolver rota sem amostra de DB (`avgDbMs` ausente): isso
  // NUNCA pode virar `NaN` na tela.
  it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY])(
    'devolve o placeholder para %s em vez de NaN',
    (value) => {
      expect(formatMs(value as number | null)).toBe(EMPTY_VALUE);
      expect(formatMb(value as number | null)).toBe(EMPTY_VALUE);
      expect(formatPercent(value as number | null)).toBe(EMPTY_VALUE);
      expect(formatNumber(value as number | null)).toBe(EMPTY_VALUE);
      expect(formatKb(value as number | null)).toBe(EMPTY_VALUE);
      expect(formatUptime(value as number | null)).toBe(EMPTY_VALUE);
    },
  );
});

describe('formatUptime', () => {
  it('humaniza segundos, minutos, horas e dias', () => {
    expect(formatUptime(47)).toBe('47s');
    expect(formatUptime(125)).toBe('2min 5s');
    expect(formatUptime(3600 * 3 + 60 * 14)).toBe('3h 14min');
    expect(formatUptime(86400 * 2 + 3600 * 3)).toBe('2d 3h');
  });

  it('rejeita valor negativo', () => {
    expect(formatUptime(-1)).toBe(EMPTY_VALUE);
  });
});

describe('formatTime / formatDateTime', () => {
  it('formata ISO válido', () => {
    expect(formatTime('2026-08-30T12:00:00.000Z')).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(formatDateTime('2026-08-30T12:00:00.000Z')).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('tolera ausência e data inválida', () => {
    expect(formatTime(null)).toBe(EMPTY_VALUE);
    expect(formatTime(undefined)).toBe(EMPTY_VALUE);
    expect(formatTime('não é data')).toBe(EMPTY_VALUE);
    expect(formatDateTime(null)).toBe(EMPTY_VALUE);
    expect(formatDateTime('não é data')).toBe(EMPTY_VALUE);
  });
});

describe('marcações de suspeita', () => {
  it('marca N+1 acima de 20 queries médias e não marca abaixo', () => {
    expect(isNPlusOneSuspect(route({ avgDbQueries: 21 }))).toBe(true);
    expect(isNPlusOneSuspect(route({ avgDbQueries: 20 }))).toBe(false);
    expect(isNPlusOneSuspect(route({ avgDbQueries: 5 }))).toBe(false);
    expect(
      isNPlusOneSuspect(route({ avgDbQueries: undefined as unknown as number })),
    ).toBe(false);
  });

  it('marca lentidão acima de 1000ms de p95', () => {
    expect(isSlowRoute(route({ p95DurationMs: 1001 }))).toBe(true);
    expect(isSlowRoute(route({ p95DurationMs: 1000 }))).toBe(false);
    expect(
      isSlowRoute(route({ p95DurationMs: undefined as unknown as number })),
    ).toBe(false);
  });

  it('trata status >= 400 como erro', () => {
    expect(isErrorStatus(200)).toBe(false);
    expect(isErrorStatus(302)).toBe(false);
    expect(isErrorStatus(400)).toBe(true);
    expect(isErrorStatus(500)).toBe(true);
    expect(isErrorStatus(undefined)).toBe(false);
  });
});

describe('sortRoutes', () => {
  const a = route({ route: 'A', p95DurationMs: 100, avgCpuMs: 30, avgDbQueries: 2 });
  const b = route({ route: 'B', p95DurationMs: 900, avgCpuMs: 10, avgDbQueries: 40 });
  const c = route({ route: 'C', p95DurationMs: 500, avgCpuMs: 20, avgDbQueries: 9 });

  it('ordena desc e asc por p95', () => {
    expect(sortRoutes([a, b, c], 'p95DurationMs', 'desc').map((r) => r.route)).toEqual([
      'B',
      'C',
      'A',
    ]);
    expect(sortRoutes([a, b, c], 'p95DurationMs', 'asc').map((r) => r.route)).toEqual([
      'A',
      'C',
      'B',
    ]);
  });

  it('ordena por CPU médio e por queries médias', () => {
    expect(sortRoutes([a, b, c], 'avgCpuMs', 'desc').map((r) => r.route)).toEqual([
      'A',
      'C',
      'B',
    ]);
    expect(sortRoutes([a, b, c], 'avgDbQueries', 'desc').map((r) => r.route)).toEqual([
      'B',
      'C',
      'A',
    ]);
  });

  it('não muta o array recebido', () => {
    const input = [a, b, c];
    sortRoutes(input, 'p95DurationMs', 'desc');
    expect(input.map((r) => r.route)).toEqual(['A', 'B', 'C']);
  });

  it('mantém ordem estável com valores iguais', () => {
    const x = route({ route: 'X', p95DurationMs: 100 });
    const y = route({ route: 'Y', p95DurationMs: 100 });
    const z = route({ route: 'Z', p95DurationMs: 100 });
    expect(sortRoutes([x, y, z], 'p95DurationMs', 'desc').map((r) => r.route)).toEqual([
      'X',
      'Y',
      'Z',
    ]);
    expect(sortRoutes([x, y, z], 'p95DurationMs', 'asc').map((r) => r.route)).toEqual([
      'X',
      'Y',
      'Z',
    ]);
  });

  it('trata valor ausente como zero em vez de NaN', () => {
    const semDb = route({ route: 'SEM', avgDbQueries: undefined as unknown as number });
    expect(sortRoutes([semDb, c], 'avgDbQueries', 'desc').map((r) => r.route)).toEqual([
      'C',
      'SEM',
    ]);
  });
});

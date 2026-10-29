import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FamilyInvestment, ResidentStatus } from '@fonte/types';
import { computeAge, formatLocalDate, getPaymentBadge } from './utils';

// Hoje fixo: 15/06/2026 (meio-dia local, longe de virada de dia).
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('getPaymentBadge', () => {
  const base = {
    familyInvestment: FamilyInvestment.PAYMENT_700,
    status: ResidentStatus.ACTIVE,
    contributionExempt: false,
  };
  const badge = (nextDueDate: string | null, overrides = {}) =>
    getPaymentBadge({ ...base, nextDueDate, ...overrides });

  it('vencido vira "Atrasado Nd" destrutivo', () => {
    expect(badge('2026-06-10')).toEqual({ label: 'Atrasado 5d', variant: 'destructive' });
  });

  it('atraso antigo conta desde a parcela em aberto mais antiga', () => {
    expect(badge('2026-05-10')).toMatchObject({ label: 'Atrasado 36d' });
  });

  it('menos de 5 dias é warning', () => {
    expect(badge('2026-06-17')).toEqual({ label: 'Vence 17/06', variant: 'warning' });
  });

  it('menos de 15 dias é info', () => {
    expect(badge('2026-06-25')).toEqual({ label: 'Vence 25/06', variant: 'info' });
  });

  it('15 dias ou mais é success', () => {
    expect(badge('2026-07-10')).toEqual({ label: 'Vence 10/07', variant: 'success' });
  });

  it('sem parcela em aberto (ex.: mês cancelado) não tem badge', () => {
    expect(badge(null)).toBeNull();
    expect(badge(undefined as never)).toBeNull();
  });

  it('isento, sem investimento, SOCIAL ou status inativo não tem badge', () => {
    expect(badge('2026-06-10', { contributionExempt: true })).toBeNull();
    expect(badge('2026-06-10', { familyInvestment: null })).toBeNull();
    expect(badge('2026-06-10', { familyInvestment: FamilyInvestment.SOCIAL })).toBeNull();
    expect(badge('2026-06-10', { status: ResidentStatus.DISCHARGED })).toBeNull();
  });
});

describe('formatLocalDate', () => {
  it('formata ISO (com ou sem hora) como dd/mm/aaaa', () => {
    expect(formatLocalDate('2026-01-02')).toBe('02/01/2026');
    expect(formatLocalDate('2026-01-02T03:00:00.000Z')).toBe('02/01/2026');
  });
});

describe('computeAge', () => {
  it('sem nascimento é null', () => {
    expect(computeAge(null)).toBeNull();
  });

  it('aniversário já passou no ano', () => {
    expect(computeAge('1990-06-01')).toBe(36);
  });

  it('aniversário ainda por vir no ano', () => {
    expect(computeAge('1990-07-01')).toBe(35);
  });

  it('mesmo mês, dia ainda por vir', () => {
    expect(computeAge('1990-06-20')).toBe(35);
  });

  it('no dia do aniversário já conta o ano', () => {
    expect(computeAge('1990-06-15')).toBe(36);
  });
});

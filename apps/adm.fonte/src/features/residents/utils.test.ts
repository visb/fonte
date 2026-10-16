import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FamilyInvestment, ResidentStatus } from '@fonte/types';
import { computeAge, formatLocalDate, getNextDueInfo, getPaymentBadge } from './utils';

// Hoje fixo: 15/06/2026 (meio-dia local, longe de virada de dia).
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('getNextDueInfo', () => {
  it('sem contribuição vence no mês corrente, no dia de vencimento', () => {
    expect(getNextDueInfo('2026-01-01', null, 10)).toEqual({
      year: 2026,
      month: 5,
      day: 10,
      isoDate: '2026-06-10',
    });
  });

  it('sem dia de vencimento usa o dia da entrada', () => {
    expect(getNextDueInfo('2026-01-20', null, null).day).toBe(20);
  });

  it('mês corrente já pago avança para o próximo', () => {
    expect(getNextDueInfo('2026-01-01', '2026-06-03T00:00:00Z', 10).isoDate).toBe('2026-07-10');
  });

  it('pagamento de dezembro vira o ano', () => {
    vi.setSystemTime(new Date(2026, 11, 5, 12));
    expect(getNextDueInfo('2026-01-01', '2026-12-01', 10).isoDate).toBe('2027-01-10');
  });

  it('contribuição antiga não avança o mês', () => {
    expect(getNextDueInfo('2026-01-01', '2026-03-01', 10).isoDate).toBe('2026-06-10');
  });

  it('dia de vencimento maior que o mês é limitado ao último dia', () => {
    vi.setSystemTime(new Date(2026, 1, 1, 12));
    expect(getNextDueInfo('2026-01-01', null, 31).isoDate).toBe('2026-02-28');
  });
});

describe('getPaymentBadge', () => {
  const badge = (dueDay: number, status = ResidentStatus.ACTIVE) =>
    getPaymentBadge('2026-01-01', FamilyInvestment.PAYMENT_700, status, null, dueDay);

  it('vencido vira "Atrasado Nd" destrutivo', () => {
    expect(badge(10)).toMatchObject({
      label: 'Atrasado 5d',
      variant: 'destructive',
      defaultDate: '2026-06-10',
      referenceMonth: 'Junho/2026',
    });
  });

  it('menos de 5 dias é warning', () => {
    expect(badge(17)).toMatchObject({ label: 'Vence 17/06', variant: 'warning' });
  });

  it('menos de 15 dias é info', () => {
    expect(badge(25)).toMatchObject({ label: 'Vence 25/06', variant: 'info' });
  });

  it('15 dias ou mais é success', () => {
    expect(badge(30)).toMatchObject({ label: 'Vence 30/06', variant: 'success' });
  });

  it('sem entrada, sem investimento, SOCIAL ou status inativo não tem badge', () => {
    expect(getPaymentBadge(null, FamilyInvestment.PAYMENT_700, ResidentStatus.ACTIVE, null, 10)).toBeNull();
    expect(getPaymentBadge('2026-01-01', null, ResidentStatus.ACTIVE, null, 10)).toBeNull();
    expect(getPaymentBadge('2026-01-01', FamilyInvestment.SOCIAL, ResidentStatus.ACTIVE, null, 10)).toBeNull();
    expect(badge(10, ResidentStatus.DISCHARGED)).toBeNull();
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

import { describe, expect, it, vi, afterEach } from 'vitest';
import { ReceivableStatus } from '@fonte/types';
import type { ResidentReceivable } from '@fonte/api-client';
import {
  formatReferenceMonth,
  formatDate,
  isOverdue,
  receivableBadge,
} from './receivables';

function makeReceivable(overrides: Partial<ResidentReceivable> = {}): ResidentReceivable {
  return {
    id: 'r1',
    referenceMonth: '2026-06-01',
    dueDate: '2026-06-10',
    status: ReceivableStatus.PENDING,
    mandatory: true,
    amount: 100,
    ...overrides,
  } as ResidentReceivable;
}

describe('formatReferenceMonth', () => {
  it('converte ISO para "Mês/Ano" em pt-BR', () => {
    expect(formatReferenceMonth('2026-06-01')).toBe('Junho/2026');
    expect(formatReferenceMonth('2026-01-15')).toBe('Janeiro/2026');
    expect(formatReferenceMonth('2025-12-01')).toBe('Dezembro/2025');
  });
});

describe('formatDate', () => {
  it('converte ISO para dd/mm/aaaa', () => {
    expect(formatDate('2026-06-10')).toBe('10/06/2026');
    expect(formatDate('2026-06-10T12:00:00Z')).toBe('10/06/2026');
  });

  it('retorna travessão para null', () => {
    expect(formatDate(null)).toBe('—');
  });
});

describe('isOverdue', () => {
  afterEach(() => vi.useRealTimers());

  it('é falso quando não está pendente', () => {
    expect(isOverdue(makeReceivable({ status: ReceivableStatus.PAID }))).toBe(false);
  });

  it('é falso quando não é obrigatório', () => {
    expect(isOverdue(makeReceivable({ mandatory: false }))).toBe(false);
  });

  it('é verdadeiro quando pendente, obrigatório e vencido', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-20T00:00:00Z'));
    expect(isOverdue(makeReceivable({ dueDate: '2026-06-10' }))).toBe(true);
  });

  it('é falso quando o vencimento ainda não chegou', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-05T00:00:00Z'));
    expect(isOverdue(makeReceivable({ dueDate: '2026-06-10' }))).toBe(false);
  });
});

describe('receivableBadge', () => {
  afterEach(() => vi.useRealTimers());

  it('Pago → success', () => {
    expect(receivableBadge(makeReceivable({ status: ReceivableStatus.PAID }))).toEqual({
      label: 'Pago',
      variant: 'success',
    });
  });

  it('Cancelado → secondary', () => {
    expect(receivableBadge(makeReceivable({ status: ReceivableStatus.CANCELED }))).toEqual({
      label: 'Cancelado',
      variant: 'secondary',
    });
  });

  it('Atrasado → destructive', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-20T00:00:00Z'));
    expect(receivableBadge(makeReceivable({ dueDate: '2026-06-10' }))).toEqual({
      label: 'Atrasado',
      variant: 'destructive',
    });
  });

  it('Pendente → warning', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-05T00:00:00Z'));
    expect(receivableBadge(makeReceivable({ dueDate: '2026-06-10' }))).toEqual({
      label: 'Pendente',
      variant: 'warning',
    });
  });
});

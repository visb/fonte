import { describe, expect, it } from 'vitest';
import { formatBRL, formatPercent, formatDate, formatMonthLabel } from './format';

describe('formatBRL', () => {
  it('formata reais com símbolo', () => {
    expect(formatBRL(50)).toMatch(/R\$\s?50,00/);
    expect(formatBRL(1234.5)).toMatch(/1\.234,50/);
  });
});

describe('formatPercent', () => {
  it('formata taxa 0..1 como porcentagem', () => {
    expect(formatPercent(0.5)).toMatch(/50/);
    expect(formatPercent(0.123)).toMatch(/12,3/);
  });
});

describe('formatDate', () => {
  it('retorna travessão para nulo/indefinido/inválido', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
  });

  it('formata YYYY-MM-DD ancorando ao meio-dia (não volta um dia)', () => {
    expect(formatDate('2026-06-16')).toBe('16/06/2026');
  });

  it('formata ISO completo', () => {
    expect(formatDate('2026-06-16T10:00:00Z')).toMatch(/\d{2}\/\d{2}\/2026/);
  });
});

describe('formatMonthLabel', () => {
  it('YYYY-MM → Mes/AA', () => {
    expect(formatMonthLabel('2026-05')).toBe('Mai/26');
    expect(formatMonthLabel('2025-01')).toBe('Jan/25');
    expect(formatMonthLabel('2026-12')).toBe('Dez/26');
  });
});

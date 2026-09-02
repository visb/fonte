import { PaymentMethod } from '@fonte/types';
import { formatBRL, formatDate, formatPaymentMethod, formatReferenceMonth } from './format';

describe('formatReferenceMonth (story 193)', () => {
  it('competência YYYY-MM-01 vira "Mês de ano"', () => {
    expect(formatReferenceMonth('2026-08-01')).toBe('Agosto de 2026');
    expect(formatReferenceMonth('2026-12-01')).toBe('Dezembro de 2026');
  });

  // O dia 1º é onde um `new Date()` local voltaria um mês em fuso negativo — e a
  // tela mostraria uma competência diferente da impressa no recibo.
  it('dia 1º não escorrega para o mês anterior', () => {
    expect(formatReferenceMonth('2026-03-01')).toBe('Março de 2026');
    expect(formatReferenceMonth('2026-01-01')).toBe('Janeiro de 2026');
  });

  it('valor inesperado volta como veio, sem "Invalid Date"', () => {
    expect(formatReferenceMonth('2026-99-01')).toBe('2026-99-01');
    expect(formatReferenceMonth('')).toBe('');
  });
});

describe('formatDate', () => {
  it('YYYY-MM-DD vira dd/mm/aaaa', () => {
    expect(formatDate('2026-08-09')).toBe('09/08/2026');
  });

  it('nulo vira traço, e valor inesperado volta como veio', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('ontem')).toBe('ontem');
  });
});

describe('formatBRL', () => {
  it('imprime o valor com duas casas', () => {
    expect(formatBRL(500)).toContain('500,00');
    expect(formatBRL(1234.5)).toContain('234,50');
  });
});

describe('formatPaymentMethod', () => {
  it('usa o dicionário compartilhado do @fonte/types', () => {
    expect(formatPaymentMethod(PaymentMethod.PIX)).toBe('PIX');
    expect(formatPaymentMethod(PaymentMethod.BASKET)).toBe('Cesta');
  });

  it('método nulo → null (a linha simplesmente não mostra a forma)', () => {
    expect(formatPaymentMethod(null)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { centsToReais, formatCents, reaisToCents } from './money';

describe('formatCents', () => {
  it('formata centavos como moeda BRL', () => {
    // Usa espaço não separável entre símbolo e valor (Intl pt-BR).
    expect(formatCents(123456).replace(/ /g, ' ')).toBe('R$ 1.234,56');
    expect(formatCents(0).replace(/ /g, ' ')).toBe('R$ 0,00');
    expect(formatCents(99).replace(/ /g, ' ')).toBe('R$ 0,99');
  });
});

describe('reaisToCents', () => {
  it('converte reais para centavos arredondando', () => {
    expect(reaisToCents(12.34)).toBe(1234);
    expect(reaisToCents(0.1)).toBe(10);
    // Arredonda meio-centavo para cima (0.125 reais = 12.5 centavos → 13).
    expect(reaisToCents(0.125)).toBe(13);
  });
});

describe('centsToReais', () => {
  it('converte centavos para reais', () => {
    expect(centsToReais(1234)).toBe(12.34);
    expect(centsToReais(0)).toBe(0);
  });

  it('é o inverso de reaisToCents para valores com 2 casas', () => {
    expect(centsToReais(reaisToCents(50.25))).toBe(50.25);
  });
});

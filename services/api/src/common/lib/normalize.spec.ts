import { normalizeName } from './normalize';

describe('normalizeName', () => {
  it('remove acentos e coloca em caixa baixa', () => {
    expect(normalizeName('João da Silva')).toBe('joao da silva');
    expect(normalizeName('ÂNGELA NÚÑEZ')).toBe('angela nunez');
    expect(normalizeName('José Antônio Conceição')).toBe('jose antonio conceicao');
  });

  it('faz trim e colapsa espaços internos', () => {
    expect(normalizeName('  Pedro   Paulo  ')).toBe('pedro paulo');
  });

  it('retorna string vazia para entrada vazia', () => {
    expect(normalizeName('')).toBe('');
    expect(normalizeName('   ')).toBe('');
  });
});

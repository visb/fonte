import { describe, expect, it } from 'vitest';
import { getInitials } from './initials';

describe('getInitials', () => {
  it('deriva primeira + última inicial de nome composto', () => {
    expect(getInitials('Maria da Silva')).toBe('MS');
    expect(getInitials('João Pedro Souza')).toBe('JS');
  });

  it('usa só a inicial quando há um único termo', () => {
    expect(getInitials('Ana')).toBe('A');
  });

  it('normaliza para maiúsculas e ignora espaços extras', () => {
    expect(getInitials('  ana   beatriz  ')).toBe('AB');
  });

  it('retorna string vazia para nome ausente ou em branco', () => {
    expect(getInitials(undefined)).toBe('');
    expect(getInitials(null)).toBe('');
    expect(getInitials('   ')).toBe('');
  });
});

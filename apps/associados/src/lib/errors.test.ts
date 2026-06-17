import { describe, expect, it } from 'vitest';
import { getErrorMessage } from './errors';

describe('getErrorMessage', () => {
  it('extrai message string do erro da API', () => {
    const error = { response: { data: { message: 'Token expirado' } } };
    expect(getErrorMessage(error)).toBe('Token expirado');
  });

  it('junta message array com vírgula', () => {
    const error = {
      response: { data: { message: ['Campo A inválido', 'Campo B inválido'] } },
    };
    expect(getErrorMessage(error)).toBe('Campo A inválido, Campo B inválido');
  });

  it('usa o fallback padrão quando não há message', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('Ocorreu um erro inesperado.');
    expect(getErrorMessage(undefined)).toBe('Ocorreu um erro inesperado.');
  });

  it('usa o fallback customizado quando informado', () => {
    expect(getErrorMessage({}, 'Erro ao salvar')).toBe('Erro ao salvar');
  });
});

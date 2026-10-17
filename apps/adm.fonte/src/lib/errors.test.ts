import { describe, expect, it } from 'vitest';
import { getErrorMessage, isNotFoundError } from './errors';

describe('getErrorMessage', () => {
  it('extrai a mensagem string do shape de erro da API', () => {
    const error = { response: { data: { message: 'Nome já cadastrado' } } };
    expect(getErrorMessage(error)).toBe('Nome já cadastrado');
  });

  it('junta um array de mensagens (class-validator) com vírgula', () => {
    const error = {
      response: { data: { message: ['Nome é obrigatório', 'Email inválido'] } },
    };
    expect(getErrorMessage(error)).toBe('Nome é obrigatório, Email inválido');
  });

  it('usa o fallback padrão quando não há mensagem', () => {
    expect(getErrorMessage({})).toBe('Ocorreu um erro inesperado.');
    expect(getErrorMessage(null)).toBe('Ocorreu um erro inesperado.');
    expect(getErrorMessage(undefined)).toBe('Ocorreu um erro inesperado.');
  });

  it('usa o fallback customizado quando informado', () => {
    expect(getErrorMessage(new Error('boom'), 'Erro ao salvar')).toBe('Erro ao salvar');
    expect(getErrorMessage({ response: {} }, 'Erro ao salvar')).toBe('Erro ao salvar');
  });
});

describe('isNotFoundError', () => {
  it('reconhece só o 404 da API', () => {
    expect(isNotFoundError({ response: { status: 404 } })).toBe(true);
    expect(isNotFoundError({ response: { status: 500 } })).toBe(false);
    expect(isNotFoundError(new Error('rede'))).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
  });
});

import { getErrorMessage, getApiErrorCode } from './errors';

describe('errors', () => {
  describe('getErrorMessage', () => {
    it('retorna a mensagem string da resposta da API', () => {
      const error = { response: { data: { message: 'Falha ao salvar' } } };
      expect(getErrorMessage(error)).toBe('Falha ao salvar');
    });

    it('junta mensagens em array com vírgula', () => {
      const error = { response: { data: { message: ['campo obrigatório', 'inválido'] } } };
      expect(getErrorMessage(error)).toBe('campo obrigatório, inválido');
    });

    it('usa o fallback quando não há mensagem', () => {
      expect(getErrorMessage({}, 'Erro padrão')).toBe('Erro padrão');
    });

    it('usa o fallback padrão quando nenhum é informado', () => {
      expect(getErrorMessage(null)).toBe('Ocorreu um erro inesperado.');
    });
  });

  describe('getApiErrorCode', () => {
    it('extrai o código de erro da resposta', () => {
      const error = { response: { data: { error: 'MUST_CHANGE_PASSWORD' } } };
      expect(getApiErrorCode(error)).toBe('MUST_CHANGE_PASSWORD');
    });

    it('retorna undefined quando não há código', () => {
      expect(getApiErrorCode({})).toBeUndefined();
      expect(getApiErrorCode(null)).toBeUndefined();
    });
  });
});

import { RESIDENT_CPF_IN_USE_CODE } from '@fonte/types';
import { getCpfConflict, getErrorMessage } from './errors';

describe('getErrorMessage', () => {
  it('usa a mensagem da API, junta listas e cai no fallback', () => {
    expect(getErrorMessage({ response: { data: { message: 'Falhou' } } })).toBe('Falhou');
    expect(getErrorMessage({ response: { data: { message: ['a', 'b'] } } })).toBe('a, b');
    expect(getErrorMessage(new Error('x'), 'Padrão')).toBe('Padrão');
    expect(getErrorMessage(null)).toBe('Ocorreu um erro inesperado.');
  });
});

describe('getCpfConflict (story 218)', () => {
  it('409 de CPF em uso → mensagem e id do dono', () => {
    const error = {
      response: {
        status: 409,
        data: { code: RESIDENT_CPF_IN_USE_CODE, message: 'Já existe…', conflictResidentId: 'r9' },
      },
    };
    expect(getCpfConflict(error)).toEqual({ message: 'Já existe…', conflictResidentId: 'r9' });
  });

  it('sem id do dono → null no id; sem mensagem → fallback', () => {
    const error = { response: { status: 409, data: { code: RESIDENT_CPF_IN_USE_CODE } } };
    expect(getCpfConflict(error)).toEqual({
      message: 'Já existe um filho com este CPF.',
      conflictResidentId: null,
    });
  });

  it('outro erro → null', () => {
    expect(getCpfConflict({ response: { status: 400, data: { message: 'x' } } })).toBeNull();
    expect(getCpfConflict(new Error('rede'))).toBeNull();
    expect(getCpfConflict(null)).toBeNull();
  });
});

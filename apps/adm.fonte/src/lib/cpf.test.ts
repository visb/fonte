import { describe, expect, it, vi } from 'vitest';
import { INVALID_CPF_MESSAGE, RESIDENT_CPF_IN_USE_CODE } from '@fonte/types';
import {
  applyCpfConflict,
  CPF_CONFLICT_ERROR_TYPE,
  cpfConflictIdOf,
  cpfField,
  cpfPayloadValue,
} from './cpf';
import { getCpfConflict } from './errors';

const VALID = '529.982.247-25';

function conflictError(conflictResidentId: string | null = 'r9') {
  return {
    response: {
      status: 409,
      data: {
        statusCode: 409,
        code: RESIDENT_CPF_IN_USE_CODE,
        message: 'Já existe um filho com este CPF: Bruno (Alta).',
        conflictResidentId,
      },
    },
  };
}

describe('cpfField (story 219)', () => {
  it('aceita vazio/ausente e CPF válido (com ou sem máscara)', () => {
    const field = cpfField();
    expect(field.safeParse(undefined).success).toBe(true);
    expect(field.safeParse('').success).toBe(true);
    expect(field.safeParse(VALID).success).toBe(true);
    expect(field.safeParse('52998224725').success).toBe(true);
  });

  it('rejeita DV errado, repetido e tamanho errado com "CPF inválido."', () => {
    const field = cpfField();
    for (const value of ['123.456.789-00', '111.111.111-11', '529.982.247']) {
      const result = field.safeParse(value);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe(INVALID_CPF_MESSAGE);
    }
  });

  it('CPF legado inválido passa enquanto não muda', () => {
    const field = cpfField('12345678900');
    expect(field.safeParse('123.456.789-00').success).toBe(true);
    expect(field.safeParse('123.456.789-01').success).toBe(false);
  });

  it('valor redigido pelo backend não é julgado', () => {
    expect(cpfField().safeParse('***.***.789-00').success).toBe(true);
  });
});

describe('cpfPayloadValue', () => {
  it('dígitos, vazio → null, redigido → undefined', () => {
    expect(cpfPayloadValue(VALID)).toBe('52998224725');
    expect(cpfPayloadValue('')).toBeNull();
    expect(cpfPayloadValue(undefined)).toBeNull();
    expect(cpfPayloadValue('***.***.789-00')).toBeUndefined();
  });
});

describe('409 de CPF em uso', () => {
  it('getCpfConflict lê mensagem e dono; outro erro → null', () => {
    expect(getCpfConflict(conflictError())).toEqual({
      message: 'Já existe um filho com este CPF: Bruno (Alta).',
      conflictResidentId: 'r9',
    });
    expect(getCpfConflict(conflictError(null))?.conflictResidentId).toBeNull();
    expect(getCpfConflict({ response: { status: 409, data: { message: 'outro' } } })).toBeNull();
    expect(getCpfConflict(new Error('rede'))).toBeNull();
  });

  it('getCpfConflict sem conflictResidentId no corpo → null no id', () => {
    const error = { response: { data: { code: RESIDENT_CPF_IN_USE_CODE, message: 'x' } } };
    expect(getCpfConflict(error)).toEqual({ message: 'x', conflictResidentId: null });
  });

  it('applyCpfConflict grava o erro no campo com o id do dono', () => {
    const setError = vi.fn();
    expect(applyCpfConflict(conflictError(), setError)).toBe(true);
    expect(setError).toHaveBeenCalledWith('cpf', {
      type: CPF_CONFLICT_ERROR_TYPE,
      message: 'Já existe um filho com este CPF: Bruno (Alta).',
      types: { [CPF_CONFLICT_ERROR_TYPE]: 'r9' },
    });
  });

  it('applyCpfConflict sem dono não põe types; erro alheio não trata', () => {
    const setError = vi.fn();
    expect(applyCpfConflict(conflictError(null), setError)).toBe(true);
    expect(setError.mock.calls[0][1].types).toBeUndefined();
    expect(applyCpfConflict(new Error('x'), setError)).toBe(false);
    expect(setError).toHaveBeenCalledTimes(1);
  });

  it('cpfConflictIdOf só lê o erro do tipo conflito', () => {
    expect(cpfConflictIdOf({ type: CPF_CONFLICT_ERROR_TYPE, types: { [CPF_CONFLICT_ERROR_TYPE]: 'r9' } })).toBe('r9');
    expect(cpfConflictIdOf({ type: CPF_CONFLICT_ERROR_TYPE })).toBeNull();
    expect(cpfConflictIdOf({ type: 'custom', message: INVALID_CPF_MESSAGE })).toBeNull();
    expect(cpfConflictIdOf(undefined)).toBeNull();
  });
});

import { ConflictException } from '@nestjs/common';
import { ResidentStatus } from '@fonte/types';
import {
  assertCpfAvailable,
  assertCpfChange,
  cpfConflictException,
  isCpfUniqueViolation,
  RESIDENT_CPF_UNIQUE_INDEX,
  rethrowCpfViolation,
} from './resident-cpf';

/** Story 219 — guarda de CPF único do filho. */
describe('resident-cpf (story 219)', () => {
  const runner = (rows: unknown[] = []) => ({ query: jest.fn().mockResolvedValue(rows) });

  it('assertCpfAvailable: sem CPF não consulta; livre passa; ocupado → 409', async () => {
    const free = runner();
    await assertCpfAvailable(free, null);
    await assertCpfAvailable(free, '');
    expect(free.query).not.toHaveBeenCalled();
    await assertCpfAvailable(free, '529.982.247-25', 'me');
    expect(free.query).toHaveBeenCalledWith(expect.stringContaining('deleted_at IS NULL'), ['52998224725', 'me']);

    const taken = runner([{ id: 'x', name: 'Zé', status: ResidentStatus.EVADED }]);
    await expect(assertCpfAvailable(taken, '52998224725')).rejects.toThrow(
      'Já existe um filho com este CPF: Zé (Evasão).',
    );
  });

  it('assertCpfChange: ausente/igual/limpo não julga; mudou → checa unicidade', () => {
    expect(assertCpfChange(undefined, '1')).toBe(false);
    expect(assertCpfChange('529.982.247-25', '52998224725')).toBe(false);
    expect(assertCpfChange(null, '52998224725')).toBe(false);
    expect(assertCpfChange('52998224725', null)).toBe(true);
    expect(() => assertCpfChange('123', null)).toThrow('CPF inválido.');
  });

  it('isCpfUniqueViolation: só 23505 do índice de CPF (direto ou em driverError)', () => {
    expect(isCpfUniqueViolation({ code: '23505', constraint: RESIDENT_CPF_UNIQUE_INDEX })).toBe(true);
    expect(isCpfUniqueViolation({ driverError: { code: '23505', constraint: RESIDENT_CPF_UNIQUE_INDEX } })).toBe(true);
    expect(isCpfUniqueViolation({ code: '23505', constraint: 'outro' })).toBe(false);
    expect(isCpfUniqueViolation({ code: '23503', constraint: RESIDENT_CPF_UNIQUE_INDEX })).toBe(false);
    expect(isCpfUniqueViolation(null)).toBe(false);
  });

  it('rethrowCpfViolation: erro alheio sobe intacto; violação vira 409 (releitura falha → sem dono)', async () => {
    const boom = new Error('boom');
    await expect(rethrowCpfViolation(boom, runner(), '52998224725')).rejects.toBe(boom);

    const failing = { query: jest.fn().mockRejectedValue(new Error('aborted')) };
    const violation = { code: '23505', constraint: RESIDENT_CPF_UNIQUE_INDEX };
    const error = await rethrowCpfViolation(violation, failing, '52998224725').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({ conflictResidentId: null });

    const noCpf = await rethrowCpfViolation(violation, failing, null).catch((e: unknown) => e);
    expect(failing.query).toHaveBeenCalledTimes(1);
    expect(noCpf).toBeInstanceOf(ConflictException);
  });

  it('cpfConflictException: status desconhecido cai no valor cru', () => {
    const error = cpfConflictException({ id: 'x', name: 'Zé', status: 'OUTRO' as ResidentStatus });
    expect((error.getResponse() as { message: string }).message).toBe('Já existe um filho com este CPF: Zé (OUTRO).');
  });
});

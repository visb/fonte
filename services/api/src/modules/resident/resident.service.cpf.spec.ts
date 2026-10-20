import { BadRequestException, ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { INVALID_CPF_MESSAGE, RESIDENT_CPF_IN_USE_CODE, ResidentStatus } from '@fonte/types';
import { ResidentService } from './resident.service';
import { Resident } from './resident.entity';
import { Admission } from './admission.entity';
import { createAuditHarness, repoMap } from '../audit/testing/audit-harness.testkit-spec';
import { RESIDENT_CPF_UNIQUE_INDEX } from './resident-cpf';

/**
 * Story 219 — CPF do filho único no cadastro, na edição e na correção de
 * identidade. A checagem do service dá o 409 amigável; a violação do índice
 * (corrida) vira o mesmo 409.
 */
const ID = 'resident-1';
const VALID = '52998224725';
const OTHER_VALID = '11144477735';

interface Setup {
  before?: Partial<Resident>;
  owner?: { id: string; name: string; status: ResidentStatus } | null;
  writeError?: unknown;
}

function uniqueViolation(constraint = RESIDENT_CPF_UNIQUE_INDEX) {
  const error = new QueryFailedError('INSERT', [], new Error('duplicate key'));
  Object.assign(error, { code: '23505', constraint });
  return error;
}

function setup({ before = {}, owner = null, writeError }: Setup = {}) {
  const current = { id: ID, name: 'Ana', status: ResidentStatus.ACTIVE, houseId: 'h1', cpf: null, ...before };
  const ownerQuery = jest.fn(async (sql: string, _params?: unknown[]): Promise<unknown[]> =>
    sql.includes('WHERE cpf = $1') && owner ? [owner] : [],
  );
  const write = jest.fn(async (...args: unknown[]) => {
    if (writeError) throw writeError;
    return args[1] ?? { affected: 1 };
  });
  const txRepo = {
    findOne: jest.fn(async () => ({ ...current })),
    update: write,
    create: jest.fn((v: object) => ({ id: ID, ...v })),
    save: jest.fn(async (v: object) => {
      if (writeError) throw writeError;
      return v;
    }),
  };
  const admissionQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
  };
  const admissionRepo = {
    create: jest.fn((v: object) => v),
    save: jest.fn(async (v: object) => v),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => admissionQb),
  };
  const harness = createAuditHarness(
    repoMap([
      [Resident, txRepo],
      [Admission, admissionRepo],
    ]),
    ownerQuery,
  );
  const residentRepo = { findOne: jest.fn(async () => ({ ...current })) };
  const service = new ResidentService(
    residentRepo as never,
    {} as never,
    {} as never,
    {} as never,
    admissionRepo as never,
    {} as never,
    {
      createAuto: jest.fn(),
      getLastContributionDates: jest.fn().mockResolvedValue(new Map()),
    } as never,
    { generateSchedule: jest.fn(), recalcFuturePending: jest.fn() } as never,
    {} as never,
    harness.dataSource as never,
    { create: jest.fn() } as never,
    harness.audit,
  );
  return { service, ownerQuery, write, txRepo };
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (error: unknown) => error,
  );
}

describe('ResidentService — CPF único (story 219)', () => {
  describe('create', () => {
    it('CPF de outro filho → 409 com conflictResidentId e nada gravado', async () => {
      const s = setup({ owner: { id: 'other', name: 'Bruno', status: ResidentStatus.DISCHARGED } });
      const error = await caught(s.service.create({ name: 'Novo', houseId: 'h1', cpf: VALID } as never));
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual({
        statusCode: 409,
        error: 'Conflict',
        code: RESIDENT_CPF_IN_USE_CODE,
        message: 'Já existe um filho com este CPF: Bruno (Alta).',
        conflictResidentId: 'other',
      });
      expect(s.txRepo.save).not.toHaveBeenCalled();
    });

    it('normaliza a máscara e consulta só filhos não excluídos', async () => {
      const s = setup();
      await s.service.create({ name: 'Novo', houseId: 'h1', cpf: '529.982.247-25' } as never);
      const [sql, params] = s.ownerQuery.mock.calls.find(([q]) => String(q).includes('WHERE cpf = $1'))!;
      expect(sql).toContain('deleted_at IS NULL');
      expect(params).toEqual([VALID, null]);
      expect(s.txRepo.create).toHaveBeenCalledWith(expect.objectContaining({ cpf: VALID }));
    });

    it('sem CPF não consulta', async () => {
      const s = setup();
      await s.service.create({ name: 'Novo', houseId: 'h1' } as never);
      expect(s.ownerQuery.mock.calls.some(([q]) => String(q).includes('WHERE cpf = $1'))).toBe(false);
    });

    it('violação 23505 do índice (corrida) vira o mesmo 409', async () => {
      const s = setup({ writeError: uniqueViolation() });
      // A checagem prévia não acha ninguém; o dono aparece na releitura.
      s.ownerQuery.mockImplementation(async (sql: string) =>
        sql.includes('WHERE cpf = $1') && s.ownerQuery.mock.calls.filter(([q]) => String(q).includes('WHERE cpf = $1')).length > 1
          ? [{ id: 'winner', name: 'Carlos', status: ResidentStatus.ACTIVE }]
          : [],
      );
      const error = await caught(s.service.create({ name: 'Novo', houseId: 'h1', cpf: VALID } as never));
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({ conflictResidentId: 'winner' });
    });

    it('outro erro de escrita sobe intacto', async () => {
      const boom = uniqueViolation('UQ_outro_indice');
      const s = setup({ writeError: boom });
      await expect(s.service.create({ name: 'Novo', houseId: 'h1', cpf: VALID } as never)).rejects.toBe(boom);
    });
  });

  describe('update', () => {
    it('mudar para CPF de outro filho → 409, excluindo o próprio id da busca', async () => {
      const s = setup({ owner: { id: 'other', name: 'Bruno', status: ResidentStatus.ACTIVE } });
      await expect(s.service.update(ID, { cpf: VALID })).rejects.toBeInstanceOf(ConflictException);
      const call = s.ownerQuery.mock.calls.find(([q]) => String(q).includes('WHERE cpf = $1'))!;
      expect(call[1]).toEqual([VALID, ID]);
      expect(s.write).not.toHaveBeenCalled();
    });

    it('mudar para CPF inválido → 400 "CPF inválido."', async () => {
      const s = setup();
      const error = await caught(s.service.update(ID, { cpf: '12345678900' }));
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as Error).message).toBe(INVALID_CPF_MESSAGE);
    });

    it('ficha legada com CPF inválido salva editando outro campo (CPF reenviado igual)', async () => {
      const s = setup({ before: { cpf: '12345' } });
      await s.service.update(ID, { name: 'Ana Maria', cpf: '12345' });
      expect(s.write).toHaveBeenCalledWith(ID, { name: 'Ana Maria', cpf: '12345' });
      expect(s.ownerQuery.mock.calls.some(([q]) => String(q).includes('WHERE cpf = $1'))).toBe(false);
    });

    it('limpar o CPF (null) não valida nem consulta', async () => {
      const s = setup({ before: { cpf: VALID } });
      await s.service.update(ID, { cpf: '' as never });
      expect(s.write).toHaveBeenCalledWith(ID, { cpf: null });
    });

    it('CPF novo e livre → grava em dígitos', async () => {
      const s = setup({ before: { cpf: VALID } });
      await s.service.update(ID, { cpf: '111.444.777-35' });
      expect(s.write).toHaveBeenCalledWith(ID, { cpf: OTHER_VALID });
    });

    it('violação 23505 na edição vira 409', async () => {
      const s = setup({ writeError: uniqueViolation() });
      await expect(s.service.update(ID, { cpf: VALID })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('updateIdentity', () => {
    it('CPF de outro filho → 409', async () => {
      const s = setup({ owner: { id: 'other', name: 'Bruno', status: ResidentStatus.ARCHIVED } });
      await expect(s.service.updateIdentity(ID, { cpf: VALID })).rejects.toThrow(
        'Já existe um filho com este CPF: Bruno (Arquivado).',
      );
    });

    it('mudar para inválido → 400; manter o legado → ok', async () => {
      const s = setup({ before: { cpf: '999' } });
      await expect(s.service.updateIdentity(ID, { cpf: '00000000000' })).rejects.toBeInstanceOf(BadRequestException);
      await s.service.updateIdentity(ID, { name: 'Ana', cpf: '999' });
      expect(s.write).toHaveBeenCalledWith(ID, { name: 'Ana', cpf: '999' });
    });

    it('violação 23505 vira 409 mesmo sem conseguir reler o dono', async () => {
      const s = setup({ writeError: uniqueViolation() });
      s.ownerQuery.mockResolvedValue([]);
      const error = await caught(s.service.updateIdentity(ID, { cpf: VALID }));
      expect((error as ConflictException).getResponse()).toMatchObject({
        message: 'Já existe um filho com este CPF.',
        conflictResidentId: null,
      });
    });
  });
});

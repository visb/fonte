import { Repository } from 'typeorm';
import { ConsentService } from './consent.service';
import { ConsentRecord } from './consent-record.entity';

function makeService(repo: Partial<Repository<ConsentRecord>>) {
  return new ConsentService(repo as Repository<ConsentRecord>, {} as never, {} as never);
}

describe('ConsentService', () => {
  it('grant writes a granted=true row', async () => {
    const save = jest.fn().mockImplementation((v) => Promise.resolve(v));
    const create = jest.fn().mockImplementation((v) => v);
    const service = makeService({ save: save as never, create: create as never });

    await service.grant('RESIDENT', 'r1', 'IMAGE_PUBLICATION', 'v1', 'u1');

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: 'r1', purpose: 'IMAGE_PUBLICATION', granted: true, termVersion: 'v1' }),
    );
    expect(save).toHaveBeenCalled();
  });

  it('revoke writes a granted=false row', async () => {
    const create = jest.fn().mockImplementation((v) => v);
    const service = makeService({ save: jest.fn().mockResolvedValue({}) as never, create: create as never });

    await service.revoke('RESIDENT', 'r1', 'IMAGE_PUBLICATION', 'u1');

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ granted: false }));
  });

  it('hasActiveConsent reflects the latest row', async () => {
    const findOne = jest.fn().mockResolvedValue({ granted: true });
    const service = makeService({ findOne: findOne as never });

    await expect(service.hasActiveConsent('RESIDENT', 'r1', 'IMAGE_PUBLICATION')).resolves.toBe(true);

    findOne.mockResolvedValue({ granted: false });
    await expect(service.hasActiveConsent('RESIDENT', 'r1', 'IMAGE_PUBLICATION')).resolves.toBe(false);

    findOne.mockResolvedValue(null);
    await expect(service.hasActiveConsent('RESIDENT', 'r1', 'IMAGE_PUBLICATION')).resolves.toBe(false);
  });

  it('statusForSubject returns one entry per purpose', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const service = makeService({ findOne: findOne as never });

    const status = await service.statusForSubject('RESIDENT', 'r1');

    expect(status.map((s) => s.purpose)).toEqual(['IMAGE_PUBLICATION', 'RELIGIOUS_DISCLOSURE']);
    expect(status.every((s) => s.granted === false)).toBe(true);
  });

  it('history lists records newest-first for the subject', async () => {
    const find = jest.fn().mockResolvedValue([{ id: 'c1' }]);
    const service = makeService({ find: find as never });
    await expect(service.history('RESIDENT', 'r1')).resolves.toEqual([{ id: 'c1' }]);
    expect(find).toHaveBeenCalledWith({
      where: { subjectType: 'RESIDENT', subjectId: 'r1' },
      order: { createdAt: 'DESC' },
    });
  });
});

describe('ConsentService.resolveSubjectForUser', () => {
  function build(relative: unknown, resident: unknown) {
    return new ConsentService(
      {} as never,
      { findOne: jest.fn().mockResolvedValue(relative) } as never,
      { findOne: jest.fn().mockResolvedValue(resident) } as never,
    );
  }

  it('resolves a RELATIVE subject', async () => {
    const service = build({ id: 'rel-1' }, null);
    await expect(service.resolveSubjectForUser('u1', 'RELATIVE')).resolves.toEqual({
      subjectType: 'RELATIVE',
      subjectId: 'rel-1',
    });
  });

  it('throws NotFound when the relative profile is missing', async () => {
    const { NotFoundException } = jest.requireActual('@nestjs/common');
    const service = build(null, null);
    await expect(service.resolveSubjectForUser('u1', 'RELATIVE')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('resolves a RESIDENT subject', async () => {
    const service = build(null, { id: 'res-1' });
    await expect(service.resolveSubjectForUser('u1', 'RESIDENT')).resolves.toEqual({
      subjectType: 'RESIDENT',
      subjectId: 'res-1',
    });
  });

  it('throws NotFound when the resident profile is missing', async () => {
    const { NotFoundException } = jest.requireActual('@nestjs/common');
    const service = build(null, null);
    await expect(service.resolveSubjectForUser('u1', 'RESIDENT')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('forbids other profile types (e.g. STAFF)', async () => {
    const { ForbiddenException } = jest.requireActual('@nestjs/common');
    const service = build(null, null);
    await expect(service.resolveSubjectForUser('u1', 'STAFF')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

// ─── Lote para o snapshot offline (story 177) ────────────────────────────────

describe('ConsentService.findForSubjects (story 177)', () => {
  function makeQb(rows: unknown[] = []) {
    const qb: Record<string, jest.Mock> = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    };
    return qb;
  }

  it('não vai ao banco com lista de titulares vazia', async () => {
    const createQueryBuilder = jest.fn();
    const service = makeService({ createQueryBuilder: createQueryBuilder as never });

    await expect(service.findForSubjects('RESIDENT', [])).resolves.toEqual([]);
    expect(createQueryBuilder).not.toHaveBeenCalled();
  });

  it('busca N titulares numa consulta só, sem recorte quando full', async () => {
    const qb = makeQb([{ id: 'c1' }]);
    const service = makeService({ createQueryBuilder: jest.fn().mockReturnValue(qb) as never });

    await expect(service.findForSubjects('RESIDENT', ['r1', 'r2'])).resolves.toEqual([{ id: 'c1' }]);
    expect(qb.andWhere).toHaveBeenCalledWith('c.subject_id IN (:...subjectIds)', {
      subjectIds: ['r1', 'r2'],
    });
    expect(qb.andWhere).not.toHaveBeenCalledWith('c.created_at > :since', expect.anything());
  });

  it('recorta o delta por created_at — a tabela é append-only', async () => {
    const qb = makeQb();
    const service = makeService({ createQueryBuilder: jest.fn().mockReturnValue(qb) as never });
    const since = new Date('2026-08-01T00:00:00.000Z');

    await service.findForSubjects('RESIDENT', ['r1'], since);

    // Revogação é linha NOVA (granted: false), então created_at basta para pegá-la.
    // O literal vai em UTC: a coluna é `timestamp` sem fuso (ver toDbTimestamp).
    expect(qb.andWhere).toHaveBeenCalledWith('c.created_at > :since', {
      since: '2026-08-01 00:00:00.000',
    });
    expect(qb.andWhere).not.toHaveBeenCalledWith(
      expect.stringContaining('updated_at'),
      expect.anything(),
    );
  });
});

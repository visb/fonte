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

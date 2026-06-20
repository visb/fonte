import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EventService } from './event.service';
import { Event } from './event.entity';
import { EventFilterDto } from './dto/list-events.dto';

// ─── Helpers ────────────────────────────────────────────────────────────────

const EVENT_ID = 'event-uuid';

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: EVENT_ID,
    title: 'Retiro de famílias',
    description: 'Encontro anual',
    startAt: new Date('2026-07-01T12:00:00Z'),
    endAt: null,
    location: 'Sede',
    capacity: null,
    registrationEnabled: false,
    bannerKey: null,
    registrationOpensAt: null,
    registrationClosesAt: null,
    createdAt: new Date('2026-06-01T12:00:00Z'),
    updatedAt: new Date('2026-06-01T12:00:00Z'),
    deletedAt: null,
    ...overrides,
  } as unknown as Event;
}

// Chainable query-builder mock returning a fixed list.
function makeQb(items: Event[] = []) {
  const qb: Record<string, jest.Mock> = {};
  ['where', 'andWhere', 'orderBy', 'addOrderBy', 'take', 'skip'].forEach((name) => {
    qb[name] = jest.fn().mockReturnValue(qb);
  });
  qb.getMany = jest.fn().mockResolvedValue(items);
  return qb;
}

type StorageMock = {
  delete: jest.Mock;
  decodeOriginalName: jest.Mock;
  uniqueFilename: jest.Mock;
  upload: jest.Mock;
};

function makeStorage(overrides: Partial<StorageMock> = {}): StorageMock {
  return {
    delete: jest.fn().mockResolvedValue(undefined),
    decodeOriginalName: jest.fn((n: string) => n),
    uniqueFilename: jest.fn((n: string, prefix = '') => `${prefix}${n}`),
    upload: jest.fn().mockResolvedValue('https://bucket/events/banner_x.png'),
    ...overrides,
  };
}

function makeService(
  repoOverrides: Partial<Repository<Event>> = {},
  storage: StorageMock = makeStorage(),
) {
  return new EventService(repoOverrides as Repository<Event>, storage as never);
}

// ─── create ───────────────────────────────────────────────────────────────────

describe('EventService.create', () => {
  it('persists fields, generates an id and returns the view shape', async () => {
    const created = makeEvent();
    const repo = {
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockResolvedValue(created),
    };
    const service = makeService(repo as never);

    const result = await service.create({
      title: 'Retiro de famílias',
      description: 'Encontro anual',
      startAt: '2026-07-01T12:00:00Z',
      location: 'Sede',
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Retiro de famílias', bannerKey: null }),
    );
    expect(result.id).toBe(EVENT_ID);
    expect(result.title).toBe('Retiro de famílias');
    expect(result.startAt).toBe('2026-07-01T12:00:00.000Z');
    expect(result.bannerUrl).toBeNull();
  });

  it('accepts a null capacity (unlimited)', async () => {
    const created = makeEvent({ capacity: null });
    const repo = {
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockResolvedValue(created),
    };
    const service = makeService(repo as never);

    const result = await service.create({
      title: 'Culto',
      description: 'Aberto',
      startAt: '2026-07-01T12:00:00Z',
    });

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ capacity: null }));
    expect(result.capacity).toBeNull();
  });

  it('defaults registrationEnabled to false when omitted', async () => {
    const repo = {
      create: jest.fn().mockImplementation((v) => makeEvent(v)),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
    };
    const service = makeService(repo as never);

    const result = await service.create({
      title: 'Culto',
      description: 'Aberto',
      startAt: '2026-07-01T12:00:00Z',
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ registrationEnabled: false }),
    );
    expect(result.registrationEnabled).toBe(false);
  });

  it('persists registrationEnabled when true', async () => {
    const repo = {
      create: jest.fn().mockImplementation((v) => makeEvent(v)),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
    };
    const service = makeService(repo as never);

    const result = await service.create({
      title: 'Retiro',
      description: 'Com inscrição',
      startAt: '2026-07-01T12:00:00Z',
      registrationEnabled: true,
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ registrationEnabled: true }),
    );
    expect(result.registrationEnabled).toBe(true);
  });

  it('skips the registration window coherence check when registration is off', async () => {
    const repo = {
      create: jest.fn().mockImplementation((v) => makeEvent(v)),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
    };
    const service = makeService(repo as never);

    // Janela incoerente, mas inscrição desligada → não valida a janela.
    await expect(
      service.create({
        title: 'X',
        description: 'Y',
        startAt: '2026-07-01T12:00:00Z',
        registrationEnabled: false,
        registrationOpensAt: '2026-06-20T12:00:00Z',
        registrationClosesAt: '2026-06-10T12:00:00Z',
      }),
    ).resolves.toBeDefined();
    expect(repo.save).toHaveBeenCalled();
  });

  it('still validates the window when registration is on (400)', async () => {
    const repo = { create: jest.fn(), save: jest.fn() };
    const service = makeService(repo as never);

    await expect(
      service.create({
        title: 'X',
        description: 'Y',
        startAt: '2026-07-01T12:00:00Z',
        registrationEnabled: true,
        registrationOpensAt: '2026-06-20T12:00:00Z',
        registrationClosesAt: '2026-06-10T12:00:00Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects endAt before startAt (400)', async () => {
    const repo = { create: jest.fn(), save: jest.fn() };
    const service = makeService(repo as never);

    await expect(
      service.create({
        title: 'X',
        description: 'Y',
        startAt: '2026-07-01T12:00:00Z',
        endAt: '2026-06-30T12:00:00Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects registrationClosesAt before registrationOpensAt (400)', async () => {
    const repo = { create: jest.fn(), save: jest.fn() };
    const service = makeService(repo as never);

    await expect(
      service.create({
        title: 'X',
        description: 'Y',
        startAt: '2026-07-01T12:00:00Z',
        registrationEnabled: true,
        registrationOpensAt: '2026-06-20T12:00:00Z',
        registrationClosesAt: '2026-06-10T12:00:00Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });
});

// ─── findAll (filters) ──────────────────────────────────────────────────────────

describe('EventService.findAll', () => {
  it('filters upcoming by start_at >= now', async () => {
    const qb = makeQb([makeEvent()]);
    const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const service = makeService(repo as never);

    await service.findAll({ filter: EventFilterDto.UPCOMING });

    expect(qb.andWhere).toHaveBeenCalledWith(
      'e.start_at >= :now',
      expect.objectContaining({ now: expect.any(Date) }),
    );
  });

  it('filters past by start_at < now', async () => {
    const qb = makeQb([makeEvent()]);
    const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const service = makeService(repo as never);

    await service.findAll({ filter: EventFilterDto.PAST });

    expect(qb.andWhere).toHaveBeenCalledWith(
      'e.start_at < :now',
      expect.objectContaining({ now: expect.any(Date) }),
    );
  });

  it('does not filter by date when filter is all (default)', async () => {
    const qb = makeQb([makeEvent()]);
    const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    const service = makeService(repo as never);

    await service.findAll({});

    expect(qb.andWhere).not.toHaveBeenCalled();
    expect(qb.orderBy).toHaveBeenCalledWith('e.start_at', 'ASC');
  });
});

// ─── findOne ────────────────────────────────────────────────────────────────────

describe('EventService.findOne', () => {
  it('throws NotFound for an unknown id', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue(null) };
    const service = makeService(repo as never);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ─── update ──────────────────────────────────────────────────────────────────────

describe('EventService.update', () => {
  it('applies partial changes and returns the updated view', async () => {
    const event = makeEvent();
    const repo = {
      findOne: jest.fn().mockResolvedValue(event),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
    };
    const service = makeService(repo as never);

    const result = await service.update(EVENT_ID, { title: 'Novo título', location: 'Anexo' });

    expect(result.title).toBe('Novo título');
    expect(result.location).toBe('Anexo');
  });

  it('toggles registrationEnabled on', async () => {
    const event = makeEvent({ registrationEnabled: false });
    const repo = {
      findOne: jest.fn().mockResolvedValue(event),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
    };
    const service = makeService(repo as never);

    const result = await service.update(EVENT_ID, { registrationEnabled: true });

    expect(result.registrationEnabled).toBe(true);
  });

  it('rejects an update that makes endAt precede startAt (400)', async () => {
    const event = makeEvent({ startAt: new Date('2026-07-01T12:00:00Z') });
    const repo = {
      findOne: jest.fn().mockResolvedValue(event),
      save: jest.fn(),
    };
    const service = makeService(repo as never);

    await expect(
      service.update(EVENT_ID, { endAt: '2026-06-01T12:00:00Z' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('throws NotFound for an unknown id', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue(null), save: jest.fn() };
    const service = makeService(repo as never);
    await expect(service.update('missing', { title: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

// ─── remove (soft delete) ────────────────────────────────────────────────────────

describe('EventService.remove', () => {
  it('soft-removes an existing event', async () => {
    const event = makeEvent();
    const repo = {
      findOne: jest.fn().mockResolvedValue(event),
      softRemove: jest.fn().mockResolvedValue(event),
    };
    const service = makeService(repo as never);

    await service.remove(EVENT_ID);

    expect(repo.softRemove).toHaveBeenCalledWith(event);
  });

  it('deletes the stored banner before soft-removing', async () => {
    const event = makeEvent({ bannerKey: 'https://bucket/events/old.png' });
    const repo = {
      findOne: jest.fn().mockResolvedValue(event),
      softRemove: jest.fn().mockResolvedValue(event),
    };
    const storage = makeStorage();
    const service = makeService(repo as never, storage);

    await service.remove(EVENT_ID);

    expect(storage.delete).toHaveBeenCalledWith('https://bucket/events/old.png');
    expect(repo.softRemove).toHaveBeenCalledWith(event);
  });

  it('throws NotFound when the event does not exist', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue(null), softRemove: jest.fn() };
    const service = makeService(repo as never);

    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.softRemove).not.toHaveBeenCalled();
  });
});

// ─── uploadBanner ──────────────────────────────────────────────────────────────────

describe('EventService.uploadBanner', () => {
  const file = {
    originalname: 'banner.png',
    buffer: Buffer.from('x'),
    mimetype: 'image/png',
  } as Express.Multer.File;

  it('uploads the file and stores the banner key', async () => {
    const event = makeEvent({ bannerKey: null });
    const repo = {
      findOne: jest.fn().mockResolvedValue(event),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
    };
    const storage = makeStorage();
    const service = makeService(repo as never, storage);

    const result = await service.uploadBanner(EVENT_ID, file);

    expect(storage.upload).toHaveBeenCalledWith(
      'events',
      expect.stringContaining('banner_'),
      file.buffer,
      'image/png',
    );
    expect(result.bannerUrl).toBe('https://bucket/events/banner_x.png');
  });

  it('deletes the previous banner before replacing it', async () => {
    const event = makeEvent({ bannerKey: 'https://bucket/events/old.png' });
    const repo = {
      findOne: jest.fn().mockResolvedValue(event),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
    };
    const storage = makeStorage();
    const service = makeService(repo as never, storage);

    await service.uploadBanner(EVENT_ID, file);

    expect(storage.delete).toHaveBeenCalledWith('https://bucket/events/old.png');
  });

  it('throws NotFound for an unknown id', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue(null), save: jest.fn() };
    const service = makeService(repo as never);

    await expect(service.uploadBanner('missing', file)).rejects.toBeInstanceOf(NotFoundException);
  });
});

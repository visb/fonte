import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PRESENT_RESIDENT_STATUSES, ResidentStatus } from '@fonte/types';
import { HouseService } from './house.service';
import { House } from './house.entity';
import { HousePhoto } from './house-photo.entity';
import { HouseRule } from './house-rule.entity';
import { StorageService } from '../storage/storage.service';

function makeHouseRepo(overrides: Record<string, jest.Mock> = {}, queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn().mockResolvedValue([]);
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'house-1', ...v })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    count: jest.fn().mockResolvedValue(1),
    softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(),
    manager: { query },
    ...overrides,
  };
}

function makeSimpleRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'x', ...v })),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
    ...overrides,
  };
}

// Story 190: o serviço não tem mais nenhuma dependência de cache — o construtor
// recebe só os repositórios e o storage. Se algum provider de cache voltar a ser
// exigido aqui, sobrou injeção no serviço.
function makeService(
  houseRepo: ReturnType<typeof makeHouseRepo>,
  photoRepo = makeSimpleRepo(),
  ruleRepo = makeSimpleRepo(),
  storage: Partial<StorageService> = {},
) {
  return new HouseService(
    houseRepo as unknown as Repository<House>,
    photoRepo as unknown as Repository<HousePhoto>,
    ruleRepo as unknown as Repository<HouseRule>,
    storage as StorageService,
  );
}

// Roteia por SQL para não depender da ordem de resolução dentro do Promise.all.
function makeAggregateQuery(rows: {
  residents?: Array<{ houseId: string; count: string }>;
  staff?: Array<{ houseId: string; count: string }>;
  thumbnails?: Array<{ houseId: string; thumbnailUrl: string }>;
}) {
  return jest.fn().mockImplementation((sql: string) => {
    if (sql.includes('FROM residents')) return Promise.resolve(rows.residents ?? []);
    if (sql.includes('FROM staff')) return Promise.resolve(rows.staff ?? []);
    if (sql.includes('FROM house_photos')) return Promise.resolve(rows.thumbnails ?? []);
    return Promise.resolve([]);
  });
}

describe('HouseService.findAll', () => {
  it('merges resident/staff counts and thumbnails per house reading straight from the DB', async () => {
    const query = makeAggregateQuery({
      residents: [{ houseId: 'h1', count: '3' }],
      staff: [{ houseId: 'h1', count: '2' }],
      thumbnails: [{ houseId: 'h1', thumbnailUrl: 'thumb.jpg' }],
    });
    const houseRepo = makeHouseRepo(
      { find: jest.fn().mockResolvedValue([{ id: 'h1' }, { id: 'h2' }]) },
      query,
    );
    const service = makeService(houseRepo, undefined, undefined, undefined);

    const result = await service.findAll();

    expect(result[0]).toMatchObject({
      id: 'h1',
      activeResidentsCount: 3,
      staffCount: 2,
      thumbnailUrl: 'thumb.jpg',
    });
    // As três agregações (filhos, staff, thumbnails) vão ao banco na mesma chamada.
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('defaults an empty house to zero counts and a null thumbnail', async () => {
    // Casa sem filho, sem servo e sem foto: nenhum agregado devolve linha para ela.
    const query = makeAggregateQuery({});
    const houseRepo = makeHouseRepo({ find: jest.fn().mockResolvedValue([{ id: 'h2' }]) }, query);
    const service = makeService(houseRepo);

    const result = await service.findAll();

    expect(result[0]).toMatchObject({
      id: 'h2',
      activeResidentsCount: 0,
      staffCount: 0,
      thumbnailUrl: null,
    });
    expect(result[0].activeResidentsCount).not.toBeUndefined();
    expect(result[0].staffCount).not.toBeUndefined();
  });

  it('counts only present, non-deleted residents', async () => {
    // A query é a única fonte agora: sem cache quente, o filtro precisa estar certo.
    const query = makeAggregateQuery({ residents: [] });
    const houseRepo = makeHouseRepo({ find: jest.fn().mockResolvedValue([{ id: 'h1' }]) }, query);
    const service = makeService(houseRepo);

    await service.findAll();

    const residentCall = query.mock.calls.find(([sql]: [string]) => sql.includes('FROM residents'));
    const [sql, params] = residentCall as [string, unknown[]];
    expect(sql).toContain('status = ANY($1)');
    expect(sql).toContain('deleted_at IS NULL');
    expect(params).toEqual([[...PRESENT_RESIDENT_STATUSES]]);
    // Status de saída/arquivo ficam de fora do filtro de ocupação.
    const statuses = (params as string[][])[0];
    expect(statuses).not.toContain(ResidentStatus.DISCHARGED);
    expect(statuses).not.toContain(ResidentStatus.EVADED);
    expect(statuses).not.toContain(ResidentStatus.ARCHIVED);
  });

  it('hits the DB on every call — no residual cache path', async () => {
    const query = makeAggregateQuery({ residents: [{ houseId: 'h1', count: '3' }] });
    const find = jest.fn().mockResolvedValue([{ id: 'h1' }]);
    const houseRepo = makeHouseRepo({ find }, query);
    const service = makeService(houseRepo);

    await service.findAll();
    await service.findAll();

    expect(find).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenCalledTimes(6); // 3 agregações × 2 chamadas
  });
});

describe('HouseService mutations', () => {
  it('create saves the house', async () => {
    const houseRepo = makeHouseRepo();
    const service = makeService(houseRepo);
    await service.create({ name: 'Comum', isMotherHouse: false } as never);
    expect(houseRepo.save).toHaveBeenCalled();
  });

  it('update persists and returns the reloaded house', async () => {
    const houseRepo = makeHouseRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'h1', photos: [] }),
    });
    const service = makeService(houseRepo);
    await service.update('h1', { name: 'Novo' } as never);
    expect(houseRepo.update).toHaveBeenCalledWith('h1', { name: 'Novo' });
  });

  it('addPhoto uploads the file and saves the row', async () => {
    const photoRepo = makeSimpleRepo();
    const storage = {
      uniqueFilename: jest.fn().mockReturnValue('new.jpg'),
      upload: jest.fn().mockResolvedValue('https://cdn/new.jpg'),
    };
    const service = makeService(makeHouseRepo(), photoRepo, makeSimpleRepo(), storage as never);

    const saved = await service.addPhoto('h1', {
      originalname: 'p.jpg',
      buffer: Buffer.from(''),
      mimetype: 'image/jpeg',
    } as never);

    expect(storage.upload).toHaveBeenCalled();
    expect(saved).toMatchObject({ houseId: 'h1', url: 'https://cdn/new.jpg' });
  });
});

describe('HouseService.findOne', () => {
  it('throws NotFound when the house is missing', async () => {
    const houseRepo = makeHouseRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(houseRepo);
    await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the house with counts read from the DB', async () => {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM residents')) return Promise.resolve([{ houseId: 'h1', count: '5' }]);
      return Promise.resolve([{ count: '4' }]); // staff
    });
    const houseRepo = makeHouseRepo(
      { findOne: jest.fn().mockResolvedValue({ id: 'h1', photos: [] }) },
      query,
    );
    const service = makeService(houseRepo);

    const result = await service.findOne('h1');
    expect(result).toMatchObject({ id: 'h1', activeResidentsCount: 5, staffCount: 4 });
  });

  it('defaults to zero counts for a house with no residents and no staff', async () => {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM residents')) return Promise.resolve([]);
      return Promise.resolve([]); // staff sem linha de agregado
    });
    const houseRepo = makeHouseRepo(
      { findOne: jest.fn().mockResolvedValue({ id: 'h2', photos: [] }) },
      query,
    );
    const service = makeService(houseRepo);

    const result = await service.findOne('h2');
    expect(result).toMatchObject({ id: 'h2', activeResidentsCount: 0, staffCount: 0 });
  });
});

describe('HouseService.create', () => {
  it('clears other mother houses before saving a new mother house', async () => {
    const execute = jest.fn().mockResolvedValue(undefined);
    const qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute,
    };
    const houseRepo = makeHouseRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const service = makeService(houseRepo);

    await service.create({ name: 'Mãe', isMotherHouse: true } as never);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(houseRepo.save).toHaveBeenCalled();
  });

  it('does not touch other houses when not a mother house', async () => {
    const houseRepo = makeHouseRepo();
    const service = makeService(houseRepo);

    await service.create({ name: 'Comum', isMotherHouse: false } as never);
    expect(houseRepo.createQueryBuilder).not.toHaveBeenCalled();
  });
});

describe('HouseService.update', () => {
  it('throws NotFound for an unknown house', async () => {
    const houseRepo = makeHouseRepo({ count: jest.fn().mockResolvedValue(0) });
    const service = makeService(houseRepo);
    await expect(service.update('nope', {} as never)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('HouseService.remove', () => {
  it('soft deletes an existing house', async () => {
    const houseRepo = makeHouseRepo({ count: jest.fn().mockResolvedValue(1) });
    const service = makeService(houseRepo);
    await service.remove('h1');
    expect(houseRepo.softDelete).toHaveBeenCalledWith('h1');
  });

  it('throws NotFound for a missing house', async () => {
    const houseRepo = makeHouseRepo({ count: jest.fn().mockResolvedValue(0) });
    const service = makeService(houseRepo);
    await expect(service.remove('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('HouseService.removePhoto', () => {
  it('deletes the file and the row', async () => {
    const photoRepo = makeSimpleRepo({ findOne: jest.fn().mockResolvedValue({ id: 'p1', url: 'x.jpg' }) });
    const storage = { delete: jest.fn().mockResolvedValue(undefined) };
    const service = makeService(makeHouseRepo(), photoRepo, makeSimpleRepo(), storage as never);

    await service.removePhoto('h1', 'p1');
    expect(storage.delete).toHaveBeenCalledWith('x.jpg');
    expect(photoRepo.delete).toHaveBeenCalledWith('p1');
  });

  it('throws NotFound for a missing photo', async () => {
    const photoRepo = makeSimpleRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(makeHouseRepo(), photoRepo);
    await expect(service.removePhoto('h1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('HouseService.findStaffForHouse', () => {
  it('seleciona a foto do servo junto das colunas do resumo (story 181)', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const houseRepo = makeHouseRepo({ count: jest.fn().mockResolvedValue(1) }, query);
    const service = makeService(houseRepo);

    await service.findStaffForHouse('h1');

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('photo_url AS "photoUrl"');
    expect(sql).toContain('FROM staff');
    expect(sql).toContain('deleted_at IS NULL');
    expect(params).toEqual(['h1']);
  });

  it('propaga photoUrl com valor e com null sem mexer no resto do payload', async () => {
    const rows = [
      { id: 's1', name: 'Ana', whatsapp: '62999990000', photoUrl: '/uploads/staff/ana.jpg' },
      { id: 's2', name: 'Bruno', whatsapp: null, photoUrl: null },
    ];
    const query = jest.fn().mockResolvedValue(rows);
    const houseRepo = makeHouseRepo({ count: jest.fn().mockResolvedValue(1) }, query);
    const service = makeService(houseRepo);

    const result = await service.findStaffForHouse('h1');

    expect(result).toEqual(rows);
  });

  it('throws NotFound for a missing house', async () => {
    const houseRepo = makeHouseRepo({ count: jest.fn().mockResolvedValue(0) });
    const service = makeService(houseRepo);
    await expect(service.findStaffForHouse('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('HouseService.findResidents', () => {
  it('lists non-deleted residents of the house ordered by name', async () => {
    const rows = [{ id: 'r1', name: 'Ana', status: 'ACTIVE', entryDate: null, photoUrl: null, photoThumbUrl: null }];
    const query = jest.fn().mockResolvedValue(rows);
    const houseRepo = makeHouseRepo({ count: jest.fn().mockResolvedValue(1) }, query);
    const service = makeService(houseRepo);

    const result = await service.findResidents('h1');

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('FROM residents');
    expect(sql).toContain('deleted_at IS NULL');
    expect(params).toEqual(['h1']);
    expect(result).toEqual(rows);
  });

  it('throws NotFound for a missing house', async () => {
    const houseRepo = makeHouseRepo({ count: jest.fn().mockResolvedValue(0) });
    const service = makeService(houseRepo);
    await expect(service.findResidents('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('HouseService rules', () => {
  it('findRules lists the rules of the house in creation order', async () => {
    const ruleRepo = makeSimpleRepo({ find: jest.fn().mockResolvedValue([{ id: 'rule-1' }]) });
    const houseRepo = makeHouseRepo({ count: jest.fn().mockResolvedValue(1) });
    const service = makeService(houseRepo, makeSimpleRepo(), ruleRepo);

    const result = await service.findRules('h1');

    expect(ruleRepo.find).toHaveBeenCalledWith({
      where: { houseId: 'h1' },
      order: { createdAt: 'ASC' },
    });
    expect(result).toEqual([{ id: 'rule-1' }]);
  });

  it('createRule persists the rule bound to the house', async () => {
    const ruleRepo = makeSimpleRepo();
    const houseRepo = makeHouseRepo({ count: jest.fn().mockResolvedValue(1) });
    const service = makeService(houseRepo, makeSimpleRepo(), ruleRepo);

    await service.createRule('h1', { title: 'Celular', content: 'Sem celular' } as never);

    expect(ruleRepo.create).toHaveBeenCalledWith({
      houseId: 'h1',
      title: 'Celular',
      content: 'Sem celular',
    });
    expect(ruleRepo.save).toHaveBeenCalled();
  });

  it('createRule throws NotFound for a missing house', async () => {
    const houseRepo = makeHouseRepo({ count: jest.fn().mockResolvedValue(0) });
    const service = makeService(houseRepo);
    await expect(service.createRule('nope', {} as never)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removeRule soft deletes an existing rule', async () => {
    const ruleRepo = makeSimpleRepo({ findOne: jest.fn().mockResolvedValue({ id: 'rule-1' }) });
    const service = makeService(makeHouseRepo(), makeSimpleRepo(), ruleRepo);

    await service.removeRule('h1', 'rule-1');

    expect(ruleRepo.softDelete).toHaveBeenCalledWith('rule-1');
  });

  it('removeRule throws NotFound for a rule of another house', async () => {
    const ruleRepo = makeSimpleRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(makeHouseRepo(), makeSimpleRepo(), ruleRepo);
    await expect(service.removeRule('h1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('HouseService.assertHouseExists', () => {
  it('throws NotFound when count is zero', async () => {
    const houseRepo = makeHouseRepo({ count: jest.fn().mockResolvedValue(0) });
    const service = makeService(houseRepo);
    await expect(service.assertHouseExists('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

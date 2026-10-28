import 'reflect-metadata';
import { BadRequestException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Repository } from 'typeorm';
import { INCIDENT_CATEGORIES_BY_TYPE, IncidentCategory, IncidentType, NotificationType } from '@fonte/types';
import { IncidentService, normalizeResidentIds } from './incident.service';
import { Incident } from './incident.entity';
import { Resident } from '../resident/resident.entity';
import {
  CreateIncidentDto,
  INCIDENT_CATEGORY_MISMATCH_MESSAGE,
  INCIDENT_CATEGORY_REQUIRED_MESSAGE,
  INCIDENT_TYPE_REQUIRED_MESSAGE,
} from './dto/create-incident.dto';

const R1 = '11111111-1111-4111-8111-111111111111';
const R2 = '22222222-2222-4222-8222-222222222222';
const R3 = '33333333-3333-4333-8333-333333333333';
const HOUSE = 'house-1';

function makeQueryBuilder(result: { many?: unknown[]; one?: unknown } = {}) {
  const qb: Record<string, jest.Mock> = {};
  for (const method of [
    'leftJoinAndSelect',
    'leftJoin',
    'addSelect',
    'innerJoin',
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
  ]) {
    qb[method] = jest.fn().mockReturnValue(qb);
  }
  qb.getMany = jest.fn().mockResolvedValue(result.many ?? []);
  qb.getOne = jest.fn().mockResolvedValue(result.one ?? null);
  return qb;
}

function makeRepo(qb = makeQueryBuilder()) {
  return {
    qb,
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'inc-1', ...v })),
  };
}

function makeResidentsRepo(residents: Array<Partial<Resident>> = []) {
  return {
    find: jest.fn().mockImplementation(({ where }) => {
      const ids: string[] = where.id.value;
      return Promise.resolve(residents.filter((r) => ids.includes(r.id!)));
    }),
  };
}

function makeNotifications() {
  return { create: jest.fn().mockResolvedValue(undefined) };
}

function makeService(
  repo = makeRepo(),
  residentsRepo = makeResidentsRepo(),
  notifications = makeNotifications(),
) {
  return new IncidentService(
    repo as unknown as Repository<Incident>,
    residentsRepo as unknown as Repository<Resident>,
    notifications as never,
  );
}

const houseResidents: Array<Partial<Resident>> = [
  { id: R1, name: 'João', houseId: HOUSE },
  { id: R2, name: 'Pedro', houseId: HOUSE },
  { id: R3, name: 'Lucas', houseId: 'other-house' },
];

function dto(extra: Partial<CreateIncidentDto> = {}): CreateIncidentDto {
  return {
    date: '2026-06-01',
    type: IncidentType.NEGATIVE,
    category: IncidentCategory.AGGRESSION,
    description: 'briga no pátio',
    houseId: HOUSE,
    responsibleId: 'staff-1',
    ...extra,
  };
}

describe('normalizeResidentIds', () => {
  it('une residentIds e o residentId legado sem duplicata', () => {
    expect(normalizeResidentIds({ residentIds: [R1, R2], residentId: R1 })).toEqual([R1, R2]);
    expect(normalizeResidentIds({ residentId: R2 })).toEqual([R2]);
    expect(normalizeResidentIds({ residentId: null })).toEqual([]);
    expect(normalizeResidentIds({})).toEqual([]);
  });
});

describe('IncidentService.findAll', () => {
  it('filtra por casa e, por filho, via join que não restringe os residentes carregados', async () => {
    const repo = makeRepo();
    await makeService(repo).findAll(HOUSE, R1);

    expect(repo.qb.andWhere).toHaveBeenCalledWith('incident.houseId = :houseId', { houseId: HOUSE });
    // join de filtro com alias próprio: a lista `residents` (alias `resident`)
    // continua trazendo TODOS os envolvidos da ocorrência.
    expect(repo.qb.innerJoin).toHaveBeenCalledWith(
      'incident.residents',
      'filterResident',
      'filterResident.id = :residentId',
      { residentId: R1 },
    );
    expect(repo.qb.leftJoin).toHaveBeenCalledWith('incident.residents', 'resident');
    expect(repo.qb.addSelect).toHaveBeenCalledWith(['resident.id', 'resident.name']);
    expect(repo.qb.orderBy).toHaveBeenCalledWith('incident.date', 'DESC');
    expect(repo.qb.addOrderBy).toHaveBeenCalledWith('incident.createdAt', 'DESC');
  });

  it('devolve a ocorrência filtrada com todos os filhos envolvidos', async () => {
    const incident = { id: 'inc-1', residents: [{ id: R1, name: 'João' }, { id: R2, name: 'Pedro' }] };
    const repo = makeRepo(makeQueryBuilder({ many: [incident] }));

    await expect(makeService(repo).findAll(undefined, R1)).resolves.toEqual([incident]);
  });

  it('sem escopo não filtra', async () => {
    const repo = makeRepo();
    await makeService(repo).findAll();

    expect(repo.qb.andWhere).not.toHaveBeenCalled();
    expect(repo.qb.innerJoin).not.toHaveBeenCalled();
  });
});

describe('IncidentService.findOne', () => {
  it('throws NotFound when missing', async () => {
    await expect(makeService().findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the incident when found', async () => {
    const repo = makeRepo(makeQueryBuilder({ one: { id: 'inc-1', residents: [] } }));
    await expect(makeService(repo).findOne('inc-1')).resolves.toEqual({ id: 'inc-1', residents: [] });
    expect(repo.qb.where).toHaveBeenCalledWith('incident.id = :id', { id: 'inc-1' });
  });
});

describe('IncidentService.create', () => {
  it('sem filho: ocorrência da casa, sem consultar residentes', async () => {
    const repo = makeRepo();
    const residentsRepo = makeResidentsRepo(houseResidents);
    const created = await makeService(repo, residentsRepo).create(dto());

    expect(residentsRepo.find).not.toHaveBeenCalled();
    expect(repo.save.mock.calls[0][0].residents).toEqual([]);
    expect(created.residents).toEqual([]);
    // No delete/softDelete is exposed by the service — incidents are immutable history.
    expect((makeService() as unknown as Record<string, unknown>).remove).toBeUndefined();
  });

  it('com 1 filho', async () => {
    const repo = makeRepo();
    const created = await makeService(repo, makeResidentsRepo(houseResidents)).create(
      dto({ residentIds: [R1] }),
    );

    expect(created.residents).toEqual([{ id: R1, name: 'João' }]);
  });

  it('com N filhos: persiste a junção e responde só id + nome', async () => {
    const repo = makeRepo();
    const created = await makeService(repo, makeResidentsRepo(houseResidents)).create(
      dto({ residentIds: [R2, R1] }),
    );

    const saved = repo.save.mock.calls[0][0];
    expect(saved.residents.map((r: Resident) => r.id)).toEqual([R2, R1]);
    expect(saved).not.toHaveProperty('residentIds');
    expect(saved).not.toHaveProperty('residentId');
    expect(created.residents).toEqual([
      { id: R2, name: 'Pedro' },
      { id: R1, name: 'João' },
    ]);
  });

  it('aceita o residentId legado (fila offline / APK antigo)', async () => {
    const repo = makeRepo();
    const created = await makeService(repo, makeResidentsRepo(houseResidents)).create(
      dto({ residentId: R1 }),
    );

    expect(created.residents).toEqual([{ id: R1, name: 'João' }]);
    expect(repo.save.mock.calls[0][0]).not.toHaveProperty('residentId');
  });

  it('legado + array com sobreposição vira união sem duplicata', async () => {
    const repo = makeRepo();
    const residentsRepo = makeResidentsRepo(houseResidents);
    const created = await makeService(repo, residentsRepo).create(
      dto({ residentIds: [R1, R2], residentId: R2 }),
    );

    expect(residentsRepo.find.mock.calls[0][0].where.id.value).toEqual([R1, R2]);
    expect(created.residents.map((r) => r.id)).toEqual([R1, R2]);
  });

  it('filho de outra casa → 400', async () => {
    const repo = makeRepo();
    const service = makeService(repo, makeResidentsRepo(houseResidents));

    await expect(service.create(dto({ residentIds: [R1, R3] }))).rejects.toThrow(
      new BadRequestException('Todos os filhos envolvidos devem ser da casa da ocorrência.'),
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('filho inexistente → 400', async () => {
    const repo = makeRepo();
    const service = makeService(repo, makeResidentsRepo(houseResidents));

    await expect(
      service.create(dto({ residentIds: [R1, '44444444-4444-4444-8444-444444444444'] })),
    ).rejects.toThrow(new BadRequestException('Filho envolvido não encontrado.'));
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('notifica ADMIN e a casa com metadata.residentIds', async () => {
    const notifications = makeNotifications();
    await makeService(makeRepo(), makeResidentsRepo(houseResidents), notifications).create(
      dto({ residentIds: [R1, R2] }),
    );

    expect(notifications.create).toHaveBeenCalledTimes(2);
    for (const [input] of notifications.create.mock.calls) {
      expect(input.type).toBe(NotificationType.INCIDENT_CREATED);
      expect(input.metadata).toEqual({ entityId: 'inc-1', residentIds: [R1, R2] });
      expect(input.metadata).not.toHaveProperty('residentId');
    }
  });

  it('persiste o tipo informado e nunca a severidade', async () => {
    const repo = makeRepo();
    const created = await makeService(repo).create(
      dto({ type: IncidentType.POSITIVE, category: IncidentCategory.SPIRITUAL_LIFE, severity: 'HIGH' }),
    );

    expect(repo.save.mock.calls[0][0].type).toBe(IncidentType.POSITIVE);
    expect(repo.save.mock.calls[0][0]).not.toHaveProperty('severity');
    expect(created.type).toBe(IncidentType.POSITIVE);
  });

  it('payload legado (severity sem type) grava NEGATIVE e categoria null', async () => {
    const repo = makeRepo();
    const created = await makeService(repo).create(
      dto({ type: undefined, category: undefined, severity: 'LOW' }),
    );

    expect(repo.save.mock.calls[0][0].type).toBe(IncidentType.NEGATIVE);
    expect(repo.save.mock.calls[0][0].category).toBeNull();
    expect(repo.save.mock.calls[0][0]).not.toHaveProperty('severity');
    expect(created.type).toBe(IncidentType.NEGATIVE);
    expect(created.category).toBeNull();
  });

  it('persiste a categoria informada (story 230)', async () => {
    const repo = makeRepo();
    const created = await makeService(repo).create(dto({ category: IncidentCategory.EVASION }));

    expect(repo.save.mock.calls[0][0].category).toBe(IncidentCategory.EVASION);
    expect(created.category).toBe(IncidentCategory.EVASION);
  });

  it.each([
    [IncidentType.POSITIVE, IncidentCategory.AGGRESSION],
    [IncidentType.NEGATIVE, IncidentCategory.GOOD_BEHAVIOR],
  ])('categoria incoerente com o tipo %s → 400 sem gravar', async (type, category) => {
    const repo = makeRepo();
    const residentsRepo = makeResidentsRepo(houseResidents);

    await expect(
      makeService(repo, residentsRepo).create(dto({ type, category, residentIds: [R1] })),
    ).rejects.toThrow(new BadRequestException(INCIDENT_CATEGORY_MISMATCH_MESSAGE));
    expect(repo.save).not.toHaveBeenCalled();
    expect(residentsRepo.find).not.toHaveBeenCalled();
  });

  it('legado sem type com categoria positiva → 400 (vale NEGATIVE)', async () => {
    await expect(
      makeService().create(dto({ type: undefined, severity: 'LOW', category: IncidentCategory.GOOD_BEHAVIOR })),
    ).rejects.toThrow(new BadRequestException(INCIDENT_CATEGORY_MISMATCH_MESSAGE));
  });

  it.each([IncidentType.POSITIVE, IncidentType.NEGATIVE])('OTHER é aceito no tipo %s', async (type) => {
    const repo = makeRepo();
    await makeService(repo).create(dto({ type, category: IncidentCategory.OTHER }));

    expect(repo.save.mock.calls[0][0]).toMatchObject({ type, category: IncidentCategory.OTHER });
  });

  it.each([
    [IncidentType.POSITIVE, 'Nova ocorrência positiva'],
    [IncidentType.NEGATIVE, 'Nova ocorrência negativa'],
  ])('título da notificação conforme o tipo %s', async (type, title) => {
    const notifications = makeNotifications();
    await makeService(makeRepo(), makeResidentsRepo(), notifications).create(
      dto({ type, category: IncidentCategory.OTHER }),
    );

    expect(notifications.create).toHaveBeenCalledTimes(2);
    for (const [input] of notifications.create.mock.calls) expect(input.title).toBe(title);
  });

  it('falha na notificação não quebra o registro', async () => {
    const notifications = { create: jest.fn().mockRejectedValue(new Error('down')) };
    const service = makeService(makeRepo(), makeResidentsRepo(), notifications);

    await expect(service.create(dto())).resolves.toMatchObject({ id: 'inc-1' });
  });

  it('falha não-Error na notificação também é engolida', async () => {
    const notifications = { create: jest.fn().mockRejectedValue('boom') };
    const service = makeService(makeRepo(), makeResidentsRepo(), notifications);

    await expect(service.create(dto())).resolves.toMatchObject({ id: 'inc-1' });
  });
});

describe('CreateIncidentDto', () => {
  const base = {
    date: '2026-06-01',
    type: IncidentType.NEGATIVE,
    category: IncidentCategory.HEALTH,
    description: 'x',
    houseId: R1,
    responsibleId: R2,
  };
  const errorsOf = async (body: Record<string, unknown>) =>
    (await validate(plainToInstance(CreateIncidentDto, body))).map((e) => e.property);

  it('aceita residentIds válidos, o legado e nenhum filho', async () => {
    expect(await errorsOf({ ...base, residentIds: [R1, R3] })).toEqual([]);
    expect(await errorsOf({ ...base, residentId: R1 })).toEqual([]);
    expect(await errorsOf({ ...base, residentId: null })).toEqual([]);
    expect(await errorsOf({ ...base, residentIds: [] })).toEqual([]);
    expect(await errorsOf(base)).toEqual([]);
  });

  it('rejeita residentIds com não-UUID, duplicata ou que não seja array', async () => {
    expect(await errorsOf({ ...base, residentIds: ['nope'] })).toEqual(['residentIds']);
    expect(await errorsOf({ ...base, residentIds: [R1, R1] })).toEqual(['residentIds']);
    expect(await errorsOf({ ...base, residentIds: R1 })).toEqual(['residentIds']);
  });
});

/** Story 229 — mesmo pipe do `main.ts`: o payload legado da fila offline tem que passar. */
describe('CreateIncidentDto × ValidationPipe global (story 229)', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const base = { date: '2026-06-01', description: 'x', houseId: R1, responsibleId: R2 };
  const run = (body: Record<string, unknown>) =>
    pipe.transform(body, { type: 'body', metatype: CreateIncidentDto }) as Promise<CreateIncidentDto>;
  const messagesOf = async (body: Record<string, unknown>): Promise<string[]> => {
    try {
      await run(body);
      return [];
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      return ((error as BadRequestException).getResponse() as { message: string[] }).message;
    }
  };

  const OTHER = IncidentCategory.OTHER;

  it.each([IncidentType.POSITIVE, IncidentType.NEGATIVE])('aceita type %s', async (type) => {
    await expect(run({ ...base, type, category: OTHER })).resolves.toMatchObject({ type });
  });

  it('sem type e sem severity → 400 com mensagem clara', async () => {
    expect(await messagesOf(base)).toEqual([INCIDENT_TYPE_REQUIRED_MESSAGE]);
  });

  it('legado: severity sem type (e sem category) passa (o service grava NEGATIVE/null)', async () => {
    const dto = await run({ ...base, severity: 'HIGH' });
    expect(dto.type).toBeUndefined();
    expect(dto.category).toBeUndefined();
    expect(dto.severity).toBe('HIGH');
  });

  it('type + severity: valida e usa o type', async () => {
    await expect(
      run({ ...base, type: IncidentType.POSITIVE, category: OTHER, severity: 'LOW' }),
    ).resolves.toMatchObject({ type: IncidentType.POSITIVE });
  });

  it('type inválido → 400, mesmo acompanhado de severity', async () => {
    expect(await messagesOf({ ...base, type: 'NEUTRAL', category: OTHER })).toEqual([
      INCIDENT_TYPE_REQUIRED_MESSAGE,
    ]);
    expect(await messagesOf({ ...base, type: 'NEUTRAL', category: OTHER, severity: 'LOW' })).toEqual([
      INCIDENT_TYPE_REQUIRED_MESSAGE,
    ]);
  });

  it('campo desconhecido continua barrado', async () => {
    expect((await messagesOf({ ...base, type: IncidentType.NEGATIVE, category: OTHER, foo: 1 })).length).toBe(1);
  });

  // Story 230
  it('payload novo (com type) sem category → 400 com mensagem clara', async () => {
    expect(await messagesOf({ ...base, type: IncidentType.NEGATIVE })).toEqual([
      INCIDENT_CATEGORY_REQUIRED_MESSAGE,
    ]);
  });

  it('category inválida → 400, inclusive no legado', async () => {
    expect(await messagesOf({ ...base, type: IncidentType.NEGATIVE, category: 'FIGHT' })).toEqual([
      INCIDENT_CATEGORY_REQUIRED_MESSAGE,
    ]);
    expect(await messagesOf({ ...base, severity: 'LOW', category: 'FIGHT' })).toEqual([
      INCIDENT_CATEGORY_REQUIRED_MESSAGE,
    ]);
  });

  it('aceita a categoria válida do contrato', async () => {
    await expect(
      run({ ...base, type: IncidentType.POSITIVE, category: IncidentCategory.HELPING_OTHERS }),
    ).resolves.toMatchObject({ category: IncidentCategory.HELPING_OTHERS });
  });
});

/** Story 230 — contrato `INCIDENT_CATEGORIES_BY_TYPE` (fonte única backend/ops). */
describe('INCIDENT_CATEGORIES_BY_TYPE', () => {
  const lists = Object.values(INCIDENT_CATEGORIES_BY_TYPE);

  it('tem uma lista para cada tipo', () => {
    expect(Object.keys(INCIDENT_CATEGORIES_BY_TYPE).sort()).toEqual(Object.values(IncidentType).sort());
  });

  it('cobre todo valor do enum', () => {
    const covered = new Set(lists.flat());
    expect([...covered].sort()).toEqual(Object.values(IncidentCategory).sort());
  });

  it('OTHER está nos dois tipos e é sempre o último', () => {
    for (const list of lists) expect(list[list.length - 1]).toBe(IncidentCategory.OTHER);
  });

  it('nenhuma categoria além de OTHER aparece nos dois tipos, nem repete na lista', () => {
    const [negative, positive] = [
      INCIDENT_CATEGORIES_BY_TYPE[IncidentType.NEGATIVE],
      INCIDENT_CATEGORIES_BY_TYPE[IncidentType.POSITIVE],
    ];
    expect(negative.filter((c) => positive.includes(c))).toEqual([IncidentCategory.OTHER]);
    for (const list of lists) expect(new Set(list).size).toBe(list.length);
  });
});

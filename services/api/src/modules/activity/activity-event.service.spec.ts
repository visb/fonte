import { Repository } from 'typeorm';
import { ActivityEventType } from '@fonte/types';
import { ActivityEventService } from './activity-event.service';
import { ActivityEvent } from './activity-event.entity';
import { ActivityUser } from './activity.service';

const COORD: ActivityUser = { userId: 'coord-user', role: 'COORDINATOR' };

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'evt-1', ...v })),
    ...overrides,
  };
}

function makeService(repo: ReturnType<typeof makeRepo>) {
  return new ActivityEventService(repo as unknown as Repository<ActivityEvent>);
}

function event(partial: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: 'evt-1',
    activityId: 'act-1',
    type: ActivityEventType.CREATED,
    actorUserId: 'coord-user',
    metadata: null,
    createdAt: new Date('2026-06-20T10:00:00.000Z'),
    ...partial,
  } as ActivityEvent;
}

describe('ActivityEventService.record', () => {
  it('persiste evento append-only com ator, tipo e metadados', async () => {
    const created: Partial<ActivityEvent>[] = [];
    const repo = makeRepo({
      create: jest.fn().mockImplementation((v) => {
        created.push(v);
        return v;
      }),
    });
    const service = makeService(repo);

    await service.record('act-1', ActivityEventType.STATUS_CHANGED, COORD, {
      from: 'DRAFT',
      to: 'REQUESTED',
    });

    expect(created[0]).toMatchObject({
      activityId: 'act-1',
      type: ActivityEventType.STATUS_CHANGED,
      actorUserId: 'coord-user',
      metadata: { from: 'DRAFT', to: 'REQUESTED' },
    });
    expect(repo.save).toHaveBeenCalled();
  });

  it('grava metadata nula por padrão', async () => {
    const created: Partial<ActivityEvent>[] = [];
    const repo = makeRepo({
      create: jest.fn().mockImplementation((v) => {
        created.push(v);
        return v;
      }),
    });
    const service = makeService(repo);

    await service.record('act-1', ActivityEventType.CREATED, COORD);

    expect(created[0].metadata).toBeNull();
  });
});

describe('ActivityEventService.findAll', () => {
  it('lista em ordem cronológica decrescente e resolve o ator pelo nome', async () => {
    const repo = makeRepo({
      find: jest.fn().mockResolvedValue([event()]),
    });
    const service = makeService(repo);
    const actorRefs = new Map([
      ['coord-user', { id: 'staff-1', name: 'Maria', userId: 'coord-user' }],
    ]);

    const result = await service.findAll('act-1', actorRefs);

    expect(repo.find).toHaveBeenCalledWith({
      where: { activityId: 'act-1' },
      order: { createdAt: 'DESC' },
    });
    expect(result[0]).toMatchObject({
      id: 'evt-1',
      activityId: 'act-1',
      type: ActivityEventType.CREATED,
      actor: { id: 'staff-1', name: 'Maria', userId: 'coord-user' },
      actorUserId: 'coord-user',
      createdAt: '2026-06-20T10:00:00.000Z',
    });
  });

  it('ator fica null quando não é staff', async () => {
    const repo = makeRepo({
      find: jest.fn().mockResolvedValue([event({ actorUserId: 'someone' })]),
    });
    const service = makeService(repo);

    const result = await service.findAll('act-1', new Map());

    expect(result[0].actor).toBeNull();
  });
});

describe('ActivityEventService.actorUserIds', () => {
  it('retorna os userIds dos atores dos eventos', async () => {
    const repo = makeRepo({
      find: jest
        .fn()
        .mockResolvedValue([event({ actorUserId: 'a' }), event({ actorUserId: 'b' })]),
    });
    const service = makeService(repo);

    await expect(service.actorUserIds('act-1')).resolves.toEqual(['a', 'b']);
  });
});

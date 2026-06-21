import { describe, expect, it } from 'vitest';
import { ActivityStatus, Role } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import { resolveDrop } from './resolveDrop';

const ADMIN = { role: Role.ADMIN, userId: 'admin-user' };
const RESPONSIBLE = { role: Role.SERVANT, userId: 'resp-user' };
const STRANGER = { role: Role.SERVANT, userId: 'other-user' };
const CREATOR = { role: Role.SERVANT, userId: 'creator-user' };

function makeActivity(status: ActivityStatus, overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'act-1',
    title: 'Consertar portão',
    description: null,
    status,
    houseId: null,
    house: null,
    responsibleStaffId: 'staff-1',
    responsible: { id: 'staff-1', name: 'Maria', userId: 'resp-user' },
    createdByUserId: 'creator-user',
    createdBy: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('resolveDrop', () => {
  it('noop quando não há atividade', () => {
    expect(resolveDrop(undefined, ActivityStatus.DOING, ADMIN)).toEqual({ kind: 'noop' });
  });

  it('noop quando não há coluna de destino (soltou fora)', () => {
    const act = makeActivity(ActivityStatus.TODO);
    expect(resolveDrop(act, undefined, ADMIN)).toEqual({ kind: 'noop' });
  });

  it('noop quando soltou na mesma coluna de origem', () => {
    const act = makeActivity(ActivityStatus.TODO);
    expect(resolveDrop(act, ActivityStatus.TODO, ADMIN)).toEqual({ kind: 'noop' });
  });

  it('move numa transição válida e permitida (responsável move TODO → DOING)', () => {
    const act = makeActivity(ActivityStatus.TODO);
    expect(resolveDrop(act, ActivityStatus.DOING, RESPONSIBLE)).toEqual({
      kind: 'move',
      activity: act,
      to: ActivityStatus.DOING,
    });
  });

  it('abre dialog de aprovação em REQUESTED → TODO (ADMIN)', () => {
    const act = makeActivity(ActivityStatus.REQUESTED);
    expect(resolveDrop(act, ActivityStatus.TODO, ADMIN)).toEqual({
      kind: 'approve',
      activity: act,
      to: ActivityStatus.TODO,
    });
  });

  it('move (sem dialog) em REQUESTED → DRAFT pelo criador — devolver', () => {
    const act = makeActivity(ActivityStatus.REQUESTED);
    expect(resolveDrop(act, ActivityStatus.DRAFT, CREATOR)).toEqual({
      kind: 'move',
      activity: act,
      to: ActivityStatus.DRAFT,
    });
  });

  it('move (sem dialog) em REQUESTED → DRAFT pelo ADMIN — devolver', () => {
    const act = makeActivity(ActivityStatus.REQUESTED);
    expect(resolveDrop(act, ActivityStatus.DRAFT, ADMIN)).toEqual({
      kind: 'move',
      activity: act,
      to: ActivityStatus.DRAFT,
    });
  });

  it('invalid (rollback) em REQUESTED → DRAFT por terceiro sem permissão', () => {
    const act = makeActivity(ActivityStatus.REQUESTED);
    expect(resolveDrop(act, ActivityStatus.DRAFT, STRANGER)).toEqual({
      kind: 'invalid',
      activity: act,
      to: ActivityStatus.DRAFT,
    });
  });

  it('invalid (rollback) quando a transição não existe na matriz', () => {
    const act = makeActivity(ActivityStatus.DRAFT);
    expect(resolveDrop(act, ActivityStatus.DONE, ADMIN)).toEqual({
      kind: 'invalid',
      activity: act,
      to: ActivityStatus.DONE,
    });
  });

  it('invalid (rollback) quando a transição existe mas o usuário não tem permissão', () => {
    const act = makeActivity(ActivityStatus.DOING);
    // STRANGER não é ADMIN nem o responsável → não pode mover.
    expect(resolveDrop(act, ActivityStatus.DONE, STRANGER)).toEqual({
      kind: 'invalid',
      activity: act,
      to: ActivityStatus.DONE,
    });
  });

  it('invalid quando não-ADMIN tenta aprovar (REQUESTED → TODO)', () => {
    const act = makeActivity(ActivityStatus.REQUESTED);
    expect(resolveDrop(act, ActivityStatus.TODO, RESPONSIBLE)).toEqual({
      kind: 'invalid',
      activity: act,
      to: ActivityStatus.TODO,
    });
  });
});

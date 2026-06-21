import { describe, expect, it } from 'vitest';
import { ActivityStatus, Role } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import {
  canTransition,
  isTransitionAllowed,
  requiresApprovalDialog,
} from './transitions';

const ADMIN = { role: Role.ADMIN, userId: 'admin-user' };
const CREATOR = { role: Role.SERVANT, userId: 'creator-user' };
const RESPONSIBLE = { role: Role.SERVANT, userId: 'resp-user' };
const STRANGER = { role: Role.SERVANT, userId: 'other-user' };

function activity(
  status: ActivityStatus,
  overrides: Partial<Pick<Activity, 'createdByUserId' | 'responsible'>> = {},
): Pick<Activity, 'status' | 'createdByUserId' | 'responsible'> {
  return {
    status,
    createdByUserId: 'creator-user',
    responsible: {
      id: 'staff-1',
      name: 'Maria',
      userId: 'resp-user',
    },
    ...overrides,
  };
}

describe('isTransitionAllowed (matriz, ignora permissão)', () => {
  it('aceita as transições da matriz do backend', () => {
    expect(isTransitionAllowed(ActivityStatus.DRAFT, ActivityStatus.REQUESTED)).toBe(true);
    expect(isTransitionAllowed(ActivityStatus.REQUESTED, ActivityStatus.TODO)).toBe(true);
    expect(isTransitionAllowed(ActivityStatus.TODO, ActivityStatus.DOING)).toBe(true);
    expect(isTransitionAllowed(ActivityStatus.DOING, ActivityStatus.TODO)).toBe(true);
    expect(isTransitionAllowed(ActivityStatus.DOING, ActivityStatus.BLOCKED)).toBe(true);
    expect(isTransitionAllowed(ActivityStatus.DOING, ActivityStatus.DONE)).toBe(true);
    expect(isTransitionAllowed(ActivityStatus.BLOCKED, ActivityStatus.DOING)).toBe(true);
    expect(isTransitionAllowed(ActivityStatus.BLOCKED, ActivityStatus.DONE)).toBe(true);
    expect(isTransitionAllowed(ActivityStatus.DONE, ActivityStatus.DOING)).toBe(true);
    // story 75: devolver solicitação para rascunho.
    expect(isTransitionAllowed(ActivityStatus.REQUESTED, ActivityStatus.DRAFT)).toBe(true);
  });

  it('rejeita transições fora da matriz', () => {
    expect(isTransitionAllowed(ActivityStatus.DRAFT, ActivityStatus.TODO)).toBe(false);
    expect(isTransitionAllowed(ActivityStatus.DRAFT, ActivityStatus.DONE)).toBe(false);
    expect(isTransitionAllowed(ActivityStatus.TODO, ActivityStatus.BLOCKED)).toBe(false);
    expect(isTransitionAllowed(ActivityStatus.REQUESTED, ActivityStatus.DOING)).toBe(false);
    expect(isTransitionAllowed(ActivityStatus.DONE, ActivityStatus.DRAFT)).toBe(false);
  });

  it('rejeita transição para o mesmo status', () => {
    expect(isTransitionAllowed(ActivityStatus.TODO, ActivityStatus.TODO)).toBe(false);
  });
});

describe('canTransition (matriz + permissão)', () => {
  describe('DRAFT → REQUESTED (criador ou ADMIN)', () => {
    it('permite ao criador', () => {
      expect(
        canTransition(activity(ActivityStatus.DRAFT), ActivityStatus.REQUESTED, CREATOR),
      ).toBe(true);
    });

    it('permite ao ADMIN mesmo não sendo o criador', () => {
      expect(
        canTransition(activity(ActivityStatus.DRAFT), ActivityStatus.REQUESTED, ADMIN),
      ).toBe(true);
    });

    it('nega a um terceiro que não é criador nem ADMIN', () => {
      expect(
        canTransition(activity(ActivityStatus.DRAFT), ActivityStatus.REQUESTED, STRANGER),
      ).toBe(false);
    });
  });

  describe('REQUESTED → TODO (só ADMIN)', () => {
    it('permite ao ADMIN', () => {
      expect(
        canTransition(activity(ActivityStatus.REQUESTED), ActivityStatus.TODO, ADMIN),
      ).toBe(true);
    });

    it('nega ao criador não-ADMIN', () => {
      expect(
        canTransition(activity(ActivityStatus.REQUESTED), ActivityStatus.TODO, CREATOR),
      ).toBe(false);
    });
  });

  describe('REQUESTED → DRAFT (criador ou ADMIN — devolver)', () => {
    it('permite ao criador', () => {
      expect(
        canTransition(activity(ActivityStatus.REQUESTED), ActivityStatus.DRAFT, CREATOR),
      ).toBe(true);
    });

    it('permite ao ADMIN mesmo não sendo o criador', () => {
      expect(
        canTransition(activity(ActivityStatus.REQUESTED), ActivityStatus.DRAFT, ADMIN),
      ).toBe(true);
    });

    it('nega a um terceiro que não é criador nem ADMIN', () => {
      expect(
        canTransition(activity(ActivityStatus.REQUESTED), ActivityStatus.DRAFT, STRANGER),
      ).toBe(false);
    });
  });

  describe('bloco de trabalho (TODO/DOING/BLOCKED/DONE): ADMIN ou responsável', () => {
    it('permite ao ADMIN', () => {
      expect(
        canTransition(activity(ActivityStatus.TODO), ActivityStatus.DOING, ADMIN),
      ).toBe(true);
    });

    it('permite ao responsável (match por userId)', () => {
      expect(
        canTransition(activity(ActivityStatus.DOING), ActivityStatus.DONE, RESPONSIBLE),
      ).toBe(true);
    });

    it('nega a quem não é responsável nem ADMIN', () => {
      expect(
        canTransition(activity(ActivityStatus.DOING), ActivityStatus.DONE, STRANGER),
      ).toBe(false);
    });

    it('nega ao não-ADMIN quando a atividade não tem responsável', () => {
      expect(
        canTransition(
          activity(ActivityStatus.DOING, { responsible: null }),
          ActivityStatus.DONE,
          RESPONSIBLE,
        ),
      ).toBe(false);
    });
  });

  it('nega transição fora da matriz independente do usuário', () => {
    expect(
      canTransition(activity(ActivityStatus.DRAFT), ActivityStatus.DONE, ADMIN),
    ).toBe(false);
  });

  it('nega quando o usuário não está autenticado (sem userId)', () => {
    expect(
      canTransition(activity(ActivityStatus.DRAFT), ActivityStatus.REQUESTED, {
        role: Role.SERVANT,
        userId: null,
      }),
    ).toBe(false);
  });
});

describe('requiresApprovalDialog', () => {
  it('é true apenas para REQUESTED → TODO', () => {
    expect(requiresApprovalDialog(ActivityStatus.REQUESTED, ActivityStatus.TODO)).toBe(true);
  });

  it('é false para as demais transições', () => {
    expect(requiresApprovalDialog(ActivityStatus.DRAFT, ActivityStatus.REQUESTED)).toBe(false);
    expect(requiresApprovalDialog(ActivityStatus.TODO, ActivityStatus.DOING)).toBe(false);
  });
});

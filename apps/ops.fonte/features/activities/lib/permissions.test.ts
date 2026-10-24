import { ActivityStatus, Role } from '@fonte/types';
import {
  canApproveRequest,
  canCreateInStatus,
  canDeleteComment,
  creatableStatuses,
  canEditDescription,
  canManageResponsible,
} from './permissions';

describe('canManageResponsible / canApproveRequest (story 220)', () => {
  const ALL = [
    ActivityStatus.DRAFT,
    ActivityStatus.REQUESTED,
    ActivityStatus.TODO,
    ActivityStatus.DOING,
    ActivityStatus.BLOCKED,
    ActivityStatus.DONE,
  ];
  const home = { houseId: 'h1' };

  it.each([Role.ADMIN, Role.COORDINATOR])(
    '%s da casa troca em todo status menos DONE',
    (role) => {
      for (const status of ALL) {
        expect(canManageResponsible({ ...home, status }, { role, houseId: 'h1' })).toBe(
          status !== ActivityStatus.DONE,
        );
      }
    },
  );

  it.each([Role.ADMIN, Role.COORDINATOR])('%s da casa aprova só em REQUESTED', (role) => {
    for (const status of ALL) {
      expect(canApproveRequest({ ...home, status }, { role, houseId: 'h1' })).toBe(
        status === ActivityStatus.REQUESTED,
      );
    }
  });

  it('SERVANT nunca troca nem aprova', () => {
    for (const status of ALL) {
      const viewer = { role: Role.SERVANT, houseId: 'h1' };
      expect(canManageResponsible({ ...home, status }, viewer)).toBe(false);
      expect(canApproveRequest({ ...home, status }, viewer)).toBe(false);
    }
  });

  it('coordenador de outra casa (ou sem casa) não troca nem aprova', () => {
    const activity = { ...home, status: ActivityStatus.REQUESTED };
    expect(canManageResponsible(activity, { role: Role.COORDINATOR, houseId: 'h2' })).toBe(false);
    expect(canApproveRequest(activity, { role: Role.COORDINATOR, houseId: 'h2' })).toBe(false);
    expect(canManageResponsible(activity, { role: Role.ADMIN, houseId: null })).toBe(false);
    expect(
      canManageResponsible({ houseId: null, status: ActivityStatus.TODO }, { role: Role.ADMIN, houseId: null }),
    ).toBe(false);
  });

  it('sem role não troca', () => {
    expect(
      canManageResponsible({ ...home, status: ActivityStatus.TODO }, { role: null, houseId: 'h1' }),
    ).toBe(false);
  });
});

describe('canCreateInStatus / creatableStatuses (story 224)', () => {
  it('servo só cria rascunho', () => {
    const viewer = { role: Role.SERVANT, houseId: 'h1' };
    expect(creatableStatuses(viewer)).toEqual([ActivityStatus.DRAFT]);
  });

  it.each([Role.COORDINATOR, Role.ADMIN])('%s da casa cria em DRAFT/REQUESTED/TODO', (role) => {
    expect(creatableStatuses({ role, houseId: 'h1' })).toEqual([
      ActivityStatus.DRAFT,
      ActivityStatus.REQUESTED,
      ActivityStatus.TODO,
    ]);
  });

  it('coordenador sem casa só cria rascunho', () => {
    expect(creatableStatuses({ role: Role.COORDINATOR, houseId: undefined })).toEqual([
      ActivityStatus.DRAFT,
    ]);
  });

  it('DOING/BLOCKED/DONE nunca', () => {
    const viewer = { role: Role.COORDINATOR, houseId: 'h1' };
    expect(canCreateInStatus(ActivityStatus.DOING, viewer)).toBe(false);
    expect(canCreateInStatus(ActivityStatus.BLOCKED, viewer)).toBe(false);
    expect(canCreateInStatus(ActivityStatus.DONE, viewer)).toBe(false);
  });
});

describe('canDeleteComment', () => {
  const comment = { createdByUserId: 'author-user' };

  it('o autor pode excluir o próprio comentário', () => {
    expect(
      canDeleteComment(comment, { role: Role.SERVANT, userId: 'author-user' }),
    ).toBe(true);
  });

  it('ADMIN pode excluir o comentário de outra pessoa', () => {
    expect(
      canDeleteComment(comment, { role: Role.ADMIN, userId: 'someone-else' }),
    ).toBe(true);
  });

  it('um terceiro (não autor, não admin) não pode excluir', () => {
    expect(
      canDeleteComment(comment, { role: Role.COORDINATOR, userId: 'someone-else' }),
    ).toBe(false);
  });

  it('sem userId não pode excluir (a menos que ADMIN)', () => {
    expect(canDeleteComment(comment, { role: Role.SERVANT, userId: null })).toBe(false);
  });
});

describe('canEditDescription', () => {
  const base = { createdByUserId: 'creator' };

  it('ADMIN edita em qualquer status', () => {
    expect(
      canEditDescription(
        { ...base, status: ActivityStatus.DONE },
        { role: Role.ADMIN, userId: 'other' },
      ),
    ).toBe(true);
  });

  it('criador edita em DRAFT/REQUESTED/TODO', () => {
    for (const status of [
      ActivityStatus.DRAFT,
      ActivityStatus.REQUESTED,
      ActivityStatus.TODO,
    ]) {
      expect(
        canEditDescription({ ...base, status }, { role: Role.SERVANT, userId: 'creator' }),
      ).toBe(true);
    }
  });

  it('criador é bloqueado a partir de DOING', () => {
    expect(
      canEditDescription(
        { ...base, status: ActivityStatus.DOING },
        { role: Role.SERVANT, userId: 'creator' },
      ),
    ).toBe(false);
  });

  it('terceiro (não criador, não admin) não edita', () => {
    expect(
      canEditDescription(
        { ...base, status: ActivityStatus.DRAFT },
        { role: Role.SERVANT, userId: 'other' },
      ),
    ).toBe(false);
  });

  it('sem userId não edita', () => {
    expect(
      canEditDescription(
        { ...base, status: ActivityStatus.DRAFT },
        { role: Role.SERVANT, userId: null },
      ),
    ).toBe(false);
  });
});

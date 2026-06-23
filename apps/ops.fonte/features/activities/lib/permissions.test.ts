import { ActivityStatus, Role } from '@fonte/types';
import { canDeleteComment, canEditDescription } from './permissions';

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

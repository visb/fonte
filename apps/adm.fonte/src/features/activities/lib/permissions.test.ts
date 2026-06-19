import { describe, expect, it } from 'vitest';
import { Role } from '@fonte/types';
import { canDeleteComment } from './permissions';

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

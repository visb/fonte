import { queryKeys } from './queryKeys';

describe('queryKeys', () => {
  it('chave estática do familiar logado', () => {
    expect(queryKeys.relativeMe).toEqual(['relative-me']);
  });

  it('chave estática dos consentimentos', () => {
    expect(queryKeys.consents).toEqual(['consents', 'me']);
  });

  it('monta a chave da thread por resident + relative', () => {
    expect(queryKeys.messages.thread('r1', 'rel1')).toEqual([
      'messages',
      'thread',
      'r1',
      'rel1',
    ]);
  });

  it('monta a chave da thread direta por staff + relative', () => {
    expect(queryKeys.messages.directThread('s1', 'rel1')).toEqual([
      'messages',
      'direct-thread',
      's1',
      'rel1',
    ]);
  });

  it('chave estática das threads com a equipe da casa', () => {
    expect(queryKeys.messages.houseStaffThreads).toEqual([
      'messages',
      'house-staff-threads',
    ]);
  });

  it('monta a chave da wishlist por resident', () => {
    expect(queryKeys.wishlist.byResident('r1')).toEqual(['wishlist', 'r1']);
  });

  it('chave estática das contribuições pagas do filho (story 193)', () => {
    expect(queryKeys.contributions.myPaid).toEqual(['contributions', 'me', 'paid']);
  });

  it('chaves de threads diferentes não colidem', () => {
    const a = queryKeys.messages.thread('r1', 'rel1');
    const b = queryKeys.messages.thread('r2', 'rel1');
    expect(a).not.toEqual(b);
  });
});

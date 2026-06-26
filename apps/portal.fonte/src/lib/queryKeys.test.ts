import { describe, expect, it } from 'vitest';
import { queryKeys } from './queryKeys';

describe('queryKeys', () => {
  it('associate.byToken monta a chave pública por token', () => {
    expect(queryKeys.associate.byToken('tok-1')).toEqual(['associate', 'public', 'tok-1']);
  });

  it('associate.cancelView inclui o segmento cancel', () => {
    expect(queryKeys.associate.cancelView('tok-1')).toEqual([
      'associate',
      'public',
      'cancel',
      'tok-1',
    ]);
  });

  it('events.list é uma chave estática', () => {
    expect(queryKeys.events.list).toEqual(['events', 'public']);
  });

  it('events.detail monta a chave por id', () => {
    expect(queryKeys.events.detail('e1')).toEqual(['events', 'public', 'e1']);
  });

  it('eventPayment.byToken monta a chave por token', () => {
    expect(queryKeys.eventPayment.byToken('tok-9')).toEqual([
      'event-payment',
      'public',
      'tok-9',
    ]);
  });
});

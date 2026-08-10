import { formatQueuedAt, pluralize } from './utils';

describe('formatQueuedAt', () => {
  const now = new Date('2026-08-10T18:00:00');

  it('lançamento de hoje mostra só a hora', () => {
    const timestamp = new Date('2026-08-10T14:32:00').getTime();
    expect(formatQueuedAt(timestamp, now)).toBe('14:32');
  });

  it('lançamento de outro dia mostra data e hora — fila presa desde ontem se vê', () => {
    const timestamp = new Date('2026-08-09T22:05:00').getTime();
    expect(formatQueuedAt(timestamp, now)).toBe('09/08 22:05');
  });

  it('timestamp inválido não quebra o card', () => {
    expect(formatQueuedAt(Number.NaN, now)).toBe('');
  });
});

describe('pluralize', () => {
  it('usa singular só no 1', () => {
    expect(pluralize(0, 'item', 'itens')).toBe('0 itens');
    expect(pluralize(1, 'item', 'itens')).toBe('1 item');
    expect(pluralize(2, 'item', 'itens')).toBe('2 itens');
  });
});

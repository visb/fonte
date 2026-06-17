import { describe, expect, it } from 'vitest';
import type { Event } from '@fonte/api-client';
import { classifyEvents } from './eventTimeline';

const NOW = new Date('2026-06-17T12:00:00.000Z');

function makeEvent(id: string, startAt: string): Event {
  return {
    id,
    title: `Evento ${id}`,
    description: 'x',
    startAt,
    endAt: null,
    location: null,
    capacity: null,
    bannerUrl: null,
    registrationOpensAt: null,
    registrationClosesAt: null,
    createdAt: startAt,
    updatedAt: startAt,
  };
}

describe('classifyEvents', () => {
  it('destaca os 3 eventos futuros mais próximos por start_at', () => {
    const events = [
      makeEvent('a', '2026-07-01T12:00:00.000Z'),
      makeEvent('b', '2026-06-20T12:00:00.000Z'),
      makeEvent('c', '2026-08-01T12:00:00.000Z'),
      makeEvent('d', '2026-09-01T12:00:00.000Z'),
    ];

    const { highlightedIds } = classifyEvents(events, NOW);

    // Os 3 futuros mais próximos: b (jun 20), a (jul 1), c (ago 1). d fica de fora.
    expect(highlightedIds.has('b')).toBe(true);
    expect(highlightedIds.has('a')).toBe(true);
    expect(highlightedIds.has('c')).toBe(true);
    expect(highlightedIds.has('d')).toBe(false);
    expect(highlightedIds.size).toBe(3);
  });

  it('marca eventos passados (start_at < now) e não os destaca', () => {
    const events = [
      makeEvent('past1', '2026-05-01T12:00:00.000Z'),
      makeEvent('past2', '2026-06-16T12:00:00.000Z'),
      makeEvent('future', '2026-07-01T12:00:00.000Z'),
    ];

    const { highlightedIds, pastIds } = classifyEvents(events, NOW);

    expect(pastIds.has('past1')).toBe(true);
    expect(pastIds.has('past2')).toBe(true);
    expect(pastIds.has('future')).toBe(false);
    expect(highlightedIds.has('past1')).toBe(false);
    expect(highlightedIds.has('future')).toBe(true);
  });

  it('ignora futuros além dos 3 no destaque', () => {
    const events = [
      makeEvent('e1', '2026-07-01T12:00:00.000Z'),
      makeEvent('e2', '2026-07-02T12:00:00.000Z'),
      makeEvent('e3', '2026-07-03T12:00:00.000Z'),
      makeEvent('e4', '2026-07-04T12:00:00.000Z'),
      makeEvent('e5', '2026-07-05T12:00:00.000Z'),
    ];

    const { highlightedIds } = classifyEvents(events, NOW);

    expect([...highlightedIds].sort()).toEqual(['e1', 'e2', 'e3']);
  });

  it('é estável em empate de datas (mantém a ordem de entrada)', () => {
    const sameDate = '2026-07-01T12:00:00.000Z';
    const events = [
      makeEvent('first', sameDate),
      makeEvent('second', sameDate),
      makeEvent('third', sameDate),
      makeEvent('fourth', sameDate),
    ];

    const { highlightedIds } = classifyEvents(events, NOW);

    expect(highlightedIds.has('first')).toBe(true);
    expect(highlightedIds.has('second')).toBe(true);
    expect(highlightedIds.has('third')).toBe(true);
    expect(highlightedIds.has('fourth')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { formatEventDate } from './formatEventDate';

describe('formatEventDate', () => {
  it('formata só o início quando não há fim', () => {
    const out = formatEventDate('2027-01-10T13:00:00.000Z', null);
    // Sem "–" quando endAt é null.
    expect(out).not.toContain('–');
    expect(out.length).toBeGreaterThan(0);
  });

  it('formata o intervalo início – fim quando há fim', () => {
    const out = formatEventDate('2027-01-10T13:00:00.000Z', '2027-01-10T18:00:00.000Z');
    expect(out).toContain('–');
    const [start, end] = out.split(' – ');
    expect(start).toBe(formatEventDate('2027-01-10T13:00:00.000Z', null));
    expect(end.length).toBeGreaterThan(0);
  });
});

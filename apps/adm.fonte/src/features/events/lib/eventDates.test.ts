import { describe, expect, it } from 'vitest';
import { isoToLocalInput, localInputToIso, formatEventDateRange } from './eventDates';

describe('isoToLocalInput / localInputToIso', () => {
  it('round-trip: local input → ISO → local input preserva o valor', () => {
    const local = '2026-06-15T14:30';
    const iso = localInputToIso(local);
    expect(iso).not.toBeNull();
    expect(isoToLocalInput(iso!)).toBe(local);
  });

  it('localInputToIso retorna null para vazio/null', () => {
    expect(localInputToIso('')).toBeNull();
    expect(localInputToIso(null)).toBeNull();
    expect(localInputToIso(undefined)).toBeNull();
  });

  it('isoToLocalInput formata com zero-padding', () => {
    const out = isoToLocalInput('2026-01-05T08:09:00');
    expect(out).toMatch(/^2026-01-05T08:09$/);
  });
});

describe('formatEventDateRange', () => {
  it('só início quando não há fim', () => {
    const out = formatEventDateRange('2026-06-15T14:30:00', null);
    expect(out).toContain('2026');
    expect(out).not.toContain('–');
  });

  it('intervalo início – fim quando há fim', () => {
    const out = formatEventDateRange('2026-06-15T14:30:00', '2026-06-15T18:00:00');
    expect(out).toContain('–');
  });
});

import { relativeTime } from './relativeTime';

describe('relativeTime (pt-BR compacto)', () => {
  const NOW = new Date('2026-06-23T12:00:00.000Z').getTime();
  beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(NOW));
  afterEach(() => jest.restoreAllMocks());

  function ago(ms: number) {
    return new Date(NOW - ms).toISOString();
  }

  it('"agora" para < 60s', () => {
    expect(relativeTime(ago(30 * 1000))).toBe('agora');
  });

  it('minutos para < 60min', () => {
    expect(relativeTime(ago(5 * 60 * 1000))).toBe('5 min');
  });

  it('horas para < 24h', () => {
    expect(relativeTime(ago(3 * 60 * 60 * 1000))).toBe('3 h');
  });

  it('dias para < 30d', () => {
    expect(relativeTime(ago(2 * 24 * 60 * 60 * 1000))).toBe('2 d');
  });

  it('data formatada para ≥ 30d', () => {
    const result = relativeTime(ago(40 * 24 * 60 * 60 * 1000));
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('clampa tempos no futuro para "agora"', () => {
    expect(relativeTime(new Date(NOW + 10000).toISOString())).toBe('agora');
  });
});

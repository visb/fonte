import { appliedLabel, changesLabel, multipleMinistriesLabel, personInitials } from './constants';

describe('constants da daily', () => {
  it('changesLabel no singular e plural', () => {
    expect(changesLabel(1)).toBe('1 mudança nos ministérios');
    expect(changesLabel(0)).toBe('0 mudanças nos ministérios');
    expect(changesLabel(4)).toBe('4 mudanças nos ministérios');
  });

  it('multipleMinistriesLabel', () => {
    expect(multipleMinistriesLabel(3)).toBe('estava em 3 ministérios');
  });

  it('personInitials', () => {
    expect(personInitials('Ana Maria Souza')).toBe('AS');
    expect(personInitials('bruno')).toBe('B');
    expect(personInitials('  ')).toBe('');
  });

  it('appliedLabel com e sem autor; sem horário', () => {
    const at = new Date(2026, 9, 27, 9, 5).toISOString();
    expect(appliedLabel(at, 'Coord')).toBe('Aplicado às 09:05 por Coord');
    expect(appliedLabel(at, null)).toBe('Aplicado às 09:05');
    expect(appliedLabel(null, 'Coord')).toBe('Aplicado');
  });
});

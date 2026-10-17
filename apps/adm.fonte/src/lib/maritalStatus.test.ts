import { describe, expect, it } from 'vitest';
import { MaritalStatus } from '@fonte/types';
import { MARITAL_STATUS_LABELS, MARITAL_STATUS_OPTIONS, maritalStatusLabel } from './maritalStatus';

describe('maritalStatus (story 210)', () => {
  it('tem rótulo para todo valor do enum', () => {
    for (const value of Object.values(MaritalStatus)) {
      expect(MARITAL_STATUS_LABELS[value], `faltou rótulo para ${value}`).toBeTruthy();
    }
  });

  it('as opções cobrem todo o enum, sem repetir', () => {
    const values = MARITAL_STATUS_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
    expect([...values].sort()).toEqual([...Object.values(MaritalStatus)].sort());
  });

  it('as opções seguem a ordem de exibição', () => {
    expect(MARITAL_STATUS_OPTIONS.map((o) => o.label)).toEqual([
      'Solteiro(a)',
      'Casado(a)',
      'União estável',
      'Divorciado(a)',
      'Viúvo(a)',
    ]);
  });

  it('maritalStatusLabel rotula, devolve cru o desconhecido e "—" o vazio', () => {
    expect(maritalStatusLabel(MaritalStatus.STABLE_UNION)).toBe('União estável');
    expect(maritalStatusLabel(MaritalStatus.WIDOWED)).toBe('Viúvo(a)');
    expect(maritalStatusLabel('OTHER')).toBe('OTHER');
    expect(maritalStatusLabel(null)).toBe('—');
    expect(maritalStatusLabel(undefined)).toBe('—');
    expect(maritalStatusLabel('')).toBe('—');
  });
});

import { describe, expect, it } from 'vitest';
import type { House } from '@fonte/api-client';
import { houseChildVacancies, ministryEligibleResidents } from './utils';

describe('ministryEligibleResidents (story 205)', () => {
  it('mantém só filhos em acolhimento (ACTIVE/DISCIPLINE/TEMP_LEAVE)', () => {
    const all = ['ACTIVE', 'DISCIPLINE', 'TEMP_LEAVE', 'DISCHARGED', 'EVADED', 'ARCHIVED', 'PRE_ADMISSION'].map(
      (status, i) => ({ id: `r${i}`, status }),
    );
    expect(ministryEligibleResidents(all).map((r) => r.status)).toEqual(['ACTIVE', 'DISCIPLINE', 'TEMP_LEAVE']);
  });
});

function makeHouse(overrides: Partial<House> = {}): House {
  return {
    id: 'h1',
    name: 'Casa',
    generalCapacity: null,
    staffCapacity: null,
    staffCount: 0,
    activeResidentsCount: 0,
    ...overrides,
  } as House;
}

describe('houseChildVacancies', () => {
  it('retorna null sem nenhuma capacidade definida', () => {
    expect(houseChildVacancies(makeHouse())).toBeNull();
  });

  it('calcula vagas de filhos pela capacidade geral menos residentes', () => {
    expect(
      houseChildVacancies(makeHouse({ generalCapacity: 10, activeResidentsCount: 4 })),
    ).toBe(6);
  });

  it('servos que estouram a capacidade de servos transbordam para vagas de filhos', () => {
    // capacidade geral 10, 0 residentes, 5 servos com staffCapacity 3 → overflow 2 → 8 vagas
    expect(
      houseChildVacancies(
        makeHouse({ generalCapacity: 10, staffCapacity: 3, staffCount: 5 }),
      ),
    ).toBe(8);
  });

  it('servos dentro da capacidade de servos não consomem vaga de filho', () => {
    expect(
      houseChildVacancies(
        makeHouse({ generalCapacity: 10, staffCapacity: 5, staffCount: 3 }),
      ),
    ).toBe(10);
  });

  it('nunca retorna negativo', () => {
    expect(
      houseChildVacancies(
        makeHouse({ generalCapacity: 2, activeResidentsCount: 5 }),
      ),
    ).toBe(0);
  });

  it('só staffCapacity definido conta como capacidade (childCapacity 0)', () => {
    expect(houseChildVacancies(makeHouse({ staffCapacity: 3, staffCount: 1 }))).toBe(0);
  });
});

import {
  DailyPersonType,
  DailySessionStatus,
  ServantRank,
  type DailyBoard,
  type DailyPerson,
} from '@fonte/types';

/** Fixtures do board da daily (story 225) para os testes do slice. */
export function resident(id: string, name: string, currentMinistryIds: string[] = []): DailyPerson {
  return { type: DailyPersonType.RESIDENT, id, name, photoThumbUrl: null, currentMinistryIds };
}

export function staff(
  id: string,
  name: string,
  currentMinistryIds: string[] = [],
  extra: Partial<DailyPerson> = {},
): DailyPerson {
  return {
    type: DailyPersonType.STAFF,
    id,
    name,
    photoThumbUrl: null,
    rank: null,
    roleLabel: 'Servo',
    currentMinistryIds,
    hadMultipleMinistries: currentMinistryIds.length > 1,
    ...extra,
  };
}

/**
 * Casa com 2 ministérios:
 * - Cozinha (m1): Bruno (filho, real m1), Carlos (servo, real m1+m2)
 * - Horta (m2): Eva (servo consagrada, real m2)
 * - Sem ministério: Ana (filha), Dora (coordenadora)
 */
export function makeBoard(overrides: Partial<DailyBoard['session']> = {}): DailyBoard {
  return {
    session: {
      id: 'sess-1',
      houseId: 'h1',
      status: DailySessionStatus.OPEN,
      sessionDate: '2026-10-27',
      version: 0,
      appliedAt: null,
      appliedByUserId: null,
      appliedByName: null,
      ...overrides,
    },
    ministries: [
      {
        id: 'm1',
        name: 'Cozinha',
        members: [resident('r1', 'Bruno', ['m1']), staff('s1', 'Carlos', ['m1', 'm2'])],
      },
      {
        id: 'm2',
        name: 'Horta',
        members: [staff('s2', 'Eva', ['m2'], { rank: ServantRank.CONSAGRADO, roleLabel: null })],
      },
    ],
    unassigned: [resident('r2', 'Ana'), staff('c1', 'Dora', [], { roleLabel: 'Coordenador' })],
  };
}

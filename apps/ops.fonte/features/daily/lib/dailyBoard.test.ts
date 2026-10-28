import { DailyPersonType, DailySessionStatus } from '@fonte/types';
import { makeBoard } from '@/lib/test/__mocks__/dailyBoardFixture';
import { isPersistableQueryKey, isResidentStoreQueryKey } from '@/lib/offline/constants';
import { queryKeys } from '@/lib/queryKeys';
import { UNASSIGNED_KEY } from '../constants';
import {
  applyMove,
  autoScrollDelta,
  boxKey,
  countChanges,
  describeSkipped,
  findDropTarget,
  findPersonBox,
  hasVersionGap,
  isReadOnly,
  isStaleEvent,
  markApplied,
  ministryIdOfKey,
  personKey,
  withVersion,
} from './dailyBoard';

const R = DailyPersonType.RESIDENT;
const S = DailyPersonType.STAFF;
const names = (list: { name: string }[]) => list.map((p) => p.name);

describe('applyMove', () => {
  it('entre caixas: sai da origem e entra no destino em ordem alfabética', () => {
    const board = makeBoard();
    const next = applyMove(board, { personType: S, personId: 's2', toMinistryId: 'm1' });
    expect(names(next.ministries[0].members)).toEqual(['Bruno', 'Carlos', 'Eva']);
    expect(next.ministries[1].members).toEqual([]);
    expect(board.ministries[1].members).toHaveLength(1); // imutável
  });

  it('para "Sem ministério"', () => {
    const next = applyMove(makeBoard(), { personType: R, personId: 'r1', toMinistryId: null });
    expect(names(next.unassigned)).toEqual(['Ana', 'Bruno', 'Dora']);
    expect(names(next.ministries[0].members)).toEqual(['Carlos']);
  });

  it('de "Sem ministério" para um ministério', () => {
    const next = applyMove(makeBoard(), { personType: R, personId: 'r2', toMinistryId: 'm2' });
    expect(names(next.unassigned)).toEqual(['Dora']);
    expect(names(next.ministries[1].members)).toEqual(['Ana', 'Eva']);
  });

  it('pessoa inexistente ou ministério desconhecido → no-op (mesmo objeto)', () => {
    const board = makeBoard();
    expect(applyMove(board, { personType: R, personId: 'nope', toMinistryId: 'm1' })).toBe(board);
    expect(applyMove(board, { personType: S, personId: 'r1', toMinistryId: 'm1' })).toBe(board);
    expect(applyMove(board, { personType: R, personId: 'r1', toMinistryId: 'm-x' })).toBe(board);
  });
});

describe('version', () => {
  it('withVersion nunca regride', () => {
    const board = makeBoard({ version: 3 });
    expect(withVersion(board, 2)).toBe(board);
    expect(withVersion(board, 3)).toBe(board);
    expect(withVersion(board, 5).session.version).toBe(5);
  });

  it('detecção de salto e de evento velho', () => {
    expect(hasVersionGap(3, 4)).toBe(false);
    expect(hasVersionGap(3, 5)).toBe(true);
    expect(isStaleEvent(3, 3)).toBe(true);
    expect(isStaleEvent(3, 2)).toBe(true);
    expect(isStaleEvent(3, 4)).toBe(false);
  });
});

describe('countChanges', () => {
  it('board igual ao real só conta o servo em vários ministérios', () => {
    // Carlos está em m1+m2 de verdade e no board só em m1 → muda ao aplicar.
    expect(countChanges(makeBoard())).toBe(1);
  });

  it('cada movimento que diverge do real soma; voltar ao real desconta', () => {
    let board = applyMove(makeBoard(), { personType: R, personId: 'r2', toMinistryId: 'm1' });
    board = applyMove(board, { personType: R, personId: 'r1', toMinistryId: null });
    expect(countChanges(board)).toBe(3);
    board = applyMove(board, { personType: R, personId: 'r1', toMinistryId: 'm1' });
    expect(countChanges(board)).toBe(2);
  });
});

describe('helpers de caixa', () => {
  it('findPersonBox: ministério, null (Sem ministério) ou undefined', () => {
    const board = makeBoard();
    expect(findPersonBox(board, R, 'r1')).toBe('m1');
    expect(findPersonBox(board, R, 'r2')).toBeNull();
    expect(findPersonBox(board, R, 'zz')).toBeUndefined();
  });

  it('boxKey/ministryIdOfKey/personKey', () => {
    expect(boxKey(null)).toBe(UNASSIGNED_KEY);
    expect(boxKey('m1')).toBe('m1');
    expect(ministryIdOfKey(UNASSIGNED_KEY)).toBeNull();
    expect(ministryIdOfKey('m1')).toBe('m1');
    expect(personKey({ type: R, id: 'r1' })).toBe('RESIDENT:r1');
  });
});

describe('markApplied / isReadOnly', () => {
  const event = {
    sessionId: 'sess-1', appliedAt: '2026-10-27T15:00:00.000Z', appliedByUserId: 'u1', appliedByName: 'Coord',
    result: { applied: 1, skipped: [] },
  };

  it('marca a sessão como aplicada (somente leitura)', () => {
    const next = markApplied(makeBoard(), event);
    expect(next.session).toMatchObject({ status: DailySessionStatus.APPLIED, appliedByName: 'Coord' });
    expect(isReadOnly(next)).toBe(true);
    expect(isReadOnly(makeBoard())).toBe(false);
  });

  it('evento de outra sessão → ignora', () => {
    const board = makeBoard();
    expect(markApplied(board, { ...event, sessionId: 'other' })).toBe(board);
  });
});

describe('describeSkipped', () => {
  it('resolve o nome pelo board de antes; quem não está vira "Pessoa removida"', () => {
    const skipped = [
      { personType: R, personId: 'r1', reason: 'saiu' },
      { personType: S, personId: 'zz', reason: 'desligado' },
    ];
    expect(describeSkipped(makeBoard(), skipped)).toEqual([
      { key: 'RESIDENT:r1', name: 'Bruno', reason: 'saiu' },
      { key: 'STAFF:zz', name: 'Pessoa removida', reason: 'desligado' },
    ]);
    expect(describeSkipped(undefined, skipped)[0].name).toBe('Pessoa removida');
  });
});

describe('drag: hit-test e auto-scroll', () => {
  const layouts = [
    { key: UNASSIGNED_KEY, y: 16, height: 100 },
    { key: 'm1', y: 128, height: 200 },
  ];

  it('findDropTarget acha a caixa sob o dedo', () => {
    expect(findDropTarget(layouts, 50)).toBe(UNASSIGNED_KEY);
    expect(findDropTarget(layouts, 200)).toBe('m1');
    expect(findDropTarget(layouts, 120)).toBeUndefined();
  });

  it('autoScrollDelta: sobe no topo, desce no rodapé, parado no meio', () => {
    expect(autoScrollDelta(0, 600)).toBe(-18);
    expect(autoScrollDelta(36, 600)).toBe(-9);
    expect(autoScrollDelta(300, 600)).toBe(0);
    expect(autoScrollDelta(600, 600)).toBe(18);
    expect(autoScrollDelta(564, 600)).toBe(9);
    expect(autoScrollDelta(10, 0)).toBe(0);
  });
});

describe('decisão 11 — a daily não vai para o disco', () => {
  it('board fora da allowlist de persistência e do store de filhos', () => {
    expect(isPersistableQueryKey(queryKeys.daily.board('h1'))).toBe(false);
    expect(isResidentStoreQueryKey(queryKeys.daily.board('h1'))).toBe(false);
  });
});

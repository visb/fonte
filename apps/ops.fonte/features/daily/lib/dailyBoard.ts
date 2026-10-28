import {
  DailySessionStatus,
  type ApplyDailySkipped,
  type DailyAppliedEvent,
  type DailyBoard,
  type DailyPerson,
  type DailyPersonType,
} from '@fonte/types';
import { DAILY_AUTO_SCROLL_EDGE, DAILY_AUTO_SCROLL_MAX_STEP, UNASSIGNED_KEY } from '../constants';

/**
 * Funções puras do board da daily (story 225). Sem React: o ViewModel e o
 * socket usam estas regras para update otimista, eventos remotos e drag.
 */

export interface DailyMove {
  personType: DailyPersonType;
  personId: string;
  toMinistryId: string | null;
}

export const personKey = (p: { type: DailyPersonType; id: string }) => `${p.type}:${p.id}`;

/** Caixa de destino ↔ chave de layout (null = "Sem ministério"). */
export const boxKey = (ministryId: string | null) => ministryId ?? UNASSIGNED_KEY;
export const ministryIdOfKey = (key: string): string | null => (key === UNASSIGNED_KEY ? null : key);

const byName = (a: DailyPerson, b: DailyPerson) => a.name.localeCompare(b.name, 'pt-BR');

/** Onde a pessoa está: id do ministério, `null` (Sem ministério) ou `undefined` (fora do board). */
export function findPersonBox(board: DailyBoard, type: DailyPersonType, id: string): string | null | undefined {
  if (board.unassigned.some((p) => p.type === type && p.id === id)) return null;
  return board.ministries.find((m) => m.members.some((p) => p.type === type && p.id === id))?.id;
}

/**
 * Aplica um movimento (local ou remoto). Pessoa inexistente ou ministério
 * destino desconhecido → no-op (devolve o MESMO objeto, para o chamador
 * perceber e refazer o GET se precisar). Ordem alfabética dentro da caixa.
 */
export function applyMove(board: DailyBoard, move: DailyMove): DailyBoard {
  const match = (p: DailyPerson) => p.type === move.personType && p.id === move.personId;
  const person =
    board.unassigned.find(match) ?? board.ministries.flatMap((m) => m.members).find(match);
  if (!person) return board;
  if (move.toMinistryId && !board.ministries.some((m) => m.id === move.toMinistryId)) return board;

  const without = (list: DailyPerson[]) => list.filter((p) => !match(p));
  const withPerson = (list: DailyPerson[]) => [...without(list), person].sort(byName);
  return {
    ...board,
    unassigned: move.toMinistryId === null ? withPerson(board.unassigned) : without(board.unassigned),
    ministries: board.ministries.map((m) => ({
      ...m,
      members: m.id === move.toMinistryId ? withPerson(m.members) : without(m.members),
    })),
  };
}

/** Grava a `version` da sessão (nunca regride). */
export function withVersion(board: DailyBoard, version: number): DailyBoard {
  if (version <= board.session.version) return board;
  return { ...board, session: { ...board.session, version } };
}

/** Evento com salto de version: perdemos movimentos → GET completo. */
export function hasVersionGap(localVersion: number, incomingVersion: number): boolean {
  return incomingVersion > localVersion + 1;
}

/** Evento que já temos (o nosso próprio, ou repetido). */
export function isStaleEvent(localVersion: number, incomingVersion: number): boolean {
  return incomingVersion <= localVersion;
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/**
 * Quantas pessoas mudam de vínculo REAL ao aplicar: destino do board vs
 * `currentMinistryIds` (servo em N ministérios que fica em 1 também conta).
 */
export function countChanges(board: DailyBoard): number {
  let count = 0;
  for (const p of board.unassigned) if (!sameSet([], p.currentMinistryIds)) count += 1;
  for (const m of board.ministries) {
    for (const p of m.members) if (!sameSet([m.id], p.currentMinistryIds)) count += 1;
  }
  return count;
}

/** `daily:applied` recebido: sessão vira somente leitura. */
export function markApplied(board: DailyBoard, event: DailyAppliedEvent): DailyBoard {
  if (board.session.id !== event.sessionId) return board;
  return {
    ...board,
    session: {
      ...board.session,
      status: DailySessionStatus.APPLIED,
      appliedAt: event.appliedAt,
      appliedByUserId: event.appliedByUserId,
      appliedByName: event.appliedByName,
    },
  };
}

export const isReadOnly = (board: DailyBoard) => board.session.status !== DailySessionStatus.OPEN;

/** Pulados no apply com o nome lido do board de antes (depois eles saem do board). */
export function describeSkipped(
  board: DailyBoard | undefined,
  skipped: ApplyDailySkipped[],
): { key: string; name: string; reason: string }[] {
  const people = board ? [...board.unassigned, ...board.ministries.flatMap((m) => m.members)] : [];
  return skipped.map((s) => ({
    key: `${s.personType}:${s.personId}`,
    name: people.find((p) => p.type === s.personType && p.id === s.personId)?.name ?? 'Pessoa removida',
    reason: s.reason,
  }));
}

export interface BoxLayout {
  key: string;
  /** Topo da caixa no conteúdo do scroll. */
  y: number;
  height: number;
}

/** Caixa sob o dedo (coordenada Y no conteúdo do scroll). */
export function findDropTarget(layouts: BoxLayout[], contentY: number): string | undefined {
  return layouts.find((l) => contentY >= l.y && contentY <= l.y + l.height)?.key;
}

/** Auto-scroll nas bordas: negativo sobe, positivo desce, 0 parado. */
export function autoScrollDelta(
  fingerY: number,
  viewportHeight: number,
  edge = DAILY_AUTO_SCROLL_EDGE,
  maxStep = DAILY_AUTO_SCROLL_MAX_STEP,
): number {
  if (viewportHeight <= 0) return 0;
  if (fingerY < edge) return -Math.ceil(((edge - Math.max(fingerY, 0)) / edge) * maxStep);
  if (fingerY > viewportHeight - edge) {
    return Math.ceil(((Math.min(fingerY, viewportHeight) - (viewportHeight - edge)) / edge) * maxStep);
  }
  return 0;
}

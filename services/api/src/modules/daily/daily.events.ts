import type { DailyAppliedEvent, DailyMovedEvent, DailyResetEvent } from '@fonte/types';

/**
 * Story 225 — eventos internos (EventEmitter2) emitidos pelo `DailyService`
 * depois do commit e consumidos pelo `DailyGateway`, que só distribui para a
 * room da sessão. O movimento entra por HTTP; o socket nunca escreve.
 */
export const DAILY_MOVED_EVENT = 'daily.moved';
export const DAILY_APPLIED_EVENT = 'daily.applied';
export const DAILY_RESET_EVENT = 'daily.reset';

export type { DailyAppliedEvent, DailyMovedEvent, DailyResetEvent };

/** Room socket.io de uma sessão. */
export function dailyRoom(sessionId: string): string {
  return `daily:${sessionId}`;
}

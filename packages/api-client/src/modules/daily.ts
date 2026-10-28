import type { AxiosInstance } from 'axios';
import type {
  ApplyDailyResult,
  DailyBoard,
  MoveDailyPersonInput,
  MoveDailyPersonResult,
} from '@fonte/types';

/**
 * Story 225 — Daily (board de ministérios em tempo real). Só ADMIN e
 * COORDINATOR. Movimentos mexem no rascunho; `apply` grava nos ministérios.
 */
export function createDailyModule(http: AxiosInstance) {
  return {
    /** Sessão aberta da casa (cria e pré-preenche se não houver). ADMIN informa a casa. */
    current: (houseId?: string | null): Promise<DailyBoard> =>
      http
        .get<DailyBoard>('/daily/current', { params: houseId ? { houseId } : undefined })
        .then((r) => r.data),
    /** Move uma pessoa no rascunho; devolve a `version` nova da sessão. */
    move: (sessionId: string, input: MoveDailyPersonInput): Promise<MoveDailyPersonResult> =>
      http.post<MoveDailyPersonResult>(`/daily-sessions/${sessionId}/moves`, input).then((r) => r.data),
    /** Grava o board nos ministérios reais (transação + auditoria). */
    apply: (sessionId: string): Promise<ApplyDailyResult> =>
      http.post<ApplyDailyResult>(`/daily-sessions/${sessionId}/apply`).then((r) => r.data),
    /** "Nova daily" depois de aplicar. */
    start: (houseId?: string | null): Promise<DailyBoard> =>
      http.post<DailyBoard>('/daily', houseId ? { houseId } : {}).then((r) => r.data),
  };
}

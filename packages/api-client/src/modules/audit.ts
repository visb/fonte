import type { AxiosInstance } from 'axios';
import type { AuditEventDetail, AuditEventFilters, AuditEventPage, AuditLog } from '../types.js';

export function createAuditModule(http: AxiosInstance) {
  return {
    /** Trilha legada de um recurso (aba Privacidade do filho). */
    byTarget: (targetType: string, targetId: string): Promise<AuditLog[]> =>
      http.get<AuditLog[]>(`/audit/${targetType}/${targetId}`).then((r) => r.data),

    /** Story 199 — eventos filtrados, paginados por cursor (ADMIN). */
    list: (filters: AuditEventFilters = {}): Promise<AuditEventPage> =>
      http.get<AuditEventPage>('/audit', { params: compact(filters) }).then((r) => r.data),

    /** Story 199 — detalhe com antes/depois e contexto (ADMIN). */
    event: (id: string): Promise<AuditEventDetail> =>
      http.get<AuditEventDetail>(`/audit/events/${id}`).then((r) => r.data),
  };
}

/** Não envia filtro vazio: a API recusa string vazia em campos validados. */
function compact(filters: AuditEventFilters): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') out[key] = value as string | number;
  }
  return out;
}

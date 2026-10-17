import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { AuditEventFilters } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Story 199 — trilha de auditoria paginada por cursor. Os filtros fazem parte
 * da chave: trocar ou limpar filtro é outra consulta e a paginação recomeça.
 */
export function useAuditEvents(filters: AuditEventFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.audit.events(filters as Record<string, unknown>),
    queryFn: ({ pageParam }) =>
      api.audit.list({ ...filters, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? null,
  });
}

/** Detalhe com antes/depois — buscado só quando o diálogo abre. */
export function useAuditEvent(id: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.audit.event(id ?? ''),
    queryFn: () => api.audit.event(id as string),
    enabled: !!id && (options?.enabled ?? true),
  });
}

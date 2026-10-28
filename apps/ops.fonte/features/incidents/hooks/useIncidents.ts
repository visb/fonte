import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { IncidentCategory, IncidentType } from '@fonte/types';
import type { Incident } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { OUTBOX_MUTATION_KEYS, useOutboxMutation } from '@/lib/offline/outbox';
import type { IncidentCreateVariables } from '@/lib/offline/mutationDefaults';

interface CreateIncidentInput {
  date: string;
  /** Story 229: positiva ou negativa (substituiu a severidade). */
  type: IncidentType;
  /** Story 230: categoria da lista do tipo (`INCIDENT_CATEGORIES_BY_TYPE`). */
  category: IncidentCategory;
  description: string;
  houseId: string;
  responsibleId: string;
  /** Story 227: filhos envolvidos (vazio = ocorrência da casa). */
  residentIds: string[];
  /** Só para o update otimista (nomes exibidos enquanto o item está pendente). */
  responsibleName?: string;
  /** Nomes na mesma ordem de `residentIds` — só para o otimista. */
  residentNames?: string[];
}

export function useIncidents(houseId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.incidents.byHouse(houseId!),
    queryFn: () => api.incidents.list({ houseId: houseId! }),
    enabled: !!houseId,
  });
}

function involvesResident(incident: Incident, residentId: string): boolean {
  // Cache anterior à story 227 pode não ter `residents`: fica de fora, sem quebrar.
  return (incident.residents ?? []).some((r) => r.id === residentId);
}

/**
 * Ocorrências do filho já presentes em qualquer lista de ocorrências do cache
 * (a da casa é prefetchada; itens pendentes da fila entram por ela). `undefined`
 * quando não há lista alguma — aí a query segue o loading normal.
 */
export function residentIncidentsFromCache(
  queryClient: QueryClient,
  residentId: string,
): Incident[] | undefined {
  const lists = queryClient
    .getQueriesData<Incident[]>({ queryKey: queryKeys.incidents.all })
    .map(([, data]) => data)
    .filter((data): data is Incident[] => Array.isArray(data));
  if (!lists.length) return undefined;

  const byId = new Map<string, Incident>();
  for (const incident of lists.flat()) {
    if (involvesResident(incident, residentId) && !byId.has(incident.id)) {
      byId.set(incident.id, incident);
    }
  }
  return [...byId.values()];
}

/**
 * Story 228: ocorrências em que o filho está envolvido, de qualquer casa (filho
 * transferido leva o histórico). Leitura de campo: persistida (`incidents`) e
 * com placeholder do cache da casa para abrir offline na primeira vez.
 *
 * O `select` refiltra por filho porque o otimista da outbox é inserido em toda
 * lista `incidents.*` do cache — sem ele, a ocorrência de outro filho apareceria
 * na ficha errada até o refetch.
 */
export function useResidentIncidents(residentId: string | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.incidents.byResident(residentId!),
    queryFn: () => api.incidents.list({ residentId: residentId! }),
    enabled: !!residentId,
    placeholderData: () => residentIncidentsFromCache(queryClient, residentId!),
    select: (incidents: Incident[]) => incidents.filter((i) => involvesResident(i, residentId!)),
  });
}

/**
 * Ocorrência é lançada no momento em que acontece, muitas vezes sem sinal: vai
 * para a outbox (story 169) e aparece na lista na hora, como pendente.
 */
export function useCreateIncident() {
  return useOutboxMutation<CreateIncidentInput, IncidentCreateVariables>(
    OUTBOX_MUTATION_KEYS.incidentCreate,
    ({ responsibleName, residentNames, ...data }) => ({ data, responsibleName, residentNames }),
  );
}

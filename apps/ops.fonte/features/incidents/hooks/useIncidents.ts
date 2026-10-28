import { useQuery } from '@tanstack/react-query';
import { IncidentSeverity } from '@fonte/types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { OUTBOX_MUTATION_KEYS, useOutboxMutation } from '@/lib/offline/outbox';
import type { IncidentCreateVariables } from '@/lib/offline/mutationDefaults';

interface CreateIncidentInput {
  date: string;
  severity: IncidentSeverity;
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

import { useQuery } from '@tanstack/react-query';
import { ResidentStatus } from '@fonte/types';
import type { CreateResidentInput, Resident, CensusConcludeInput } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { OUTBOX_MUTATION_KEYS, useOutboxMutation } from '@/lib/offline/outbox';
import type {
  CensusAddResidentVariables,
  CensusConcludeVariables,
  PickedPhoto,
} from '@/lib/offline/mutationDefaults';

// Census ("Contagem") is a rollout-only tool: it lists the active residents of a
// house so a coordinator can confirm who is really present, remove who isn't, and
// register residents missing from our records.

// Statuses shown on the census list: ACTIVE plus the ones added during this very
// census (CENSUS_ADDED) — they are present, just awaiting ADM approval.
const CENSUS_VISIBLE_STATUSES: ResidentStatus[] = [
  ResidentStatus.ACTIVE,
  ResidentStatus.CENSUS_ADDED,
];

export function useActiveResidentsByHouse(houseId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.residents.byHouse(houseId!),
    queryFn: () => api.residents.listByHouse(houseId!),
    enabled: !!houseId,
    select: (residents: Resident[]) =>
      residents.filter((r) => CENSUS_VISIBLE_STATUSES.includes(r.status)),
  });
}

// Adds a resident during the census: created as CENSUS_ADDED (pending ADM approval)
// and the ADM is notified. A foto vai numa segunda mutation encadeada (story 169,
// decisão 7): o endpoint de foto precisa do id, que só existe depois do envio.
export function useCensusAddResident(houseId: string) {
  return useOutboxMutation<
    { data: CreateResidentInput; photo?: PickedPhoto },
    CensusAddResidentVariables,
    Resident
  >(OUTBOX_MUTATION_KEYS.censusAddResident, ({ data, photo }) => ({ houseId, data, photo }));
}

// Concludes the census ("chamada"): notifies the ADM. When residents were added
// during the count, the ADM notification offers a review action.
export function useConcludeCensus(houseId: string) {
  return useOutboxMutation<CensusConcludeInput, CensusConcludeVariables>(
    OUTBOX_MUTATION_KEYS.censusConclude,
    (data) => ({ houseId, data }),
  );
}

// Baixa de filho (alta/evasão/transferência) e a lista de casas de destino
// moraram aqui até a story 196. Agora vivem em
// `features/residents/hooks/useResidentRemoval.ts`, porque a ação também sai da
// lista de filhos — a contagem deixou de ser o único caminho.

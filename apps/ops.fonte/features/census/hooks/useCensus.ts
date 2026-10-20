import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RESIDENT_LOOKUP_MIN_LENGTH, ResidentStatus, type ResidentLookupItem } from '@fonte/types';
import type { CreateResidentInput, Resident, CensusConcludeInput } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { OUTBOX_MUTATION_KEYS, useOutboxMutation } from '@/lib/offline/outbox';
import type {
  CensusAddResidentVariables,
  CensusConcludeVariables,
  CensusReadmitResidentVariables,
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

// Story 218 — candidatos a reacolhimento (alta/evasão/arquivado) da comunidade
// inteira. Exige rede: `residentLookup` fica fora do cache persistido (LGPD).
export function useResidentLookup(term: string, options?: { enabled?: boolean }) {
  const q = term.trim();
  return useQuery({
    queryKey: queryKeys.residentLookup.search(q),
    queryFn: () => api.residents.lookup(q),
    enabled: (options?.enabled ?? true) && q.length >= RESIDENT_LOOKUP_MIN_LENGTH,
    // Sem sinal a busca não tem o que mostrar: falha de rede não é repetida.
    retry: false,
  });
}

// Story 218 (decisão 7) — 409 de CPF em uso no cadastro novo: acha o dono entre
// os candidatos a reacolhimento. `null` se ele está em acolhimento (é
// transferência, fluxo do adm) ou se a busca falhar.
export function useFindReadmitCandidate() {
  const queryClient = useQueryClient();
  return useCallback(
    async (cpf: string, residentId: string): Promise<ResidentLookupItem | null> => {
      try {
        const candidates = await queryClient.fetchQuery({
          queryKey: queryKeys.residentLookup.search(cpf),
          queryFn: () => api.residents.lookup(cpf),
          retry: false,
        });
        return candidates.find((candidate) => candidate.id === residentId) ?? null;
      } catch {
        return null;
      }
    },
    [queryClient],
  );
}

// Story 218 — reacolhe o filho escolhido na casa da contagem. Payload mínimo
// (decisão 8); a `mutationFn` mora no default da outbox.
export function useCensusReadmit(houseId: string) {
  return useOutboxMutation<
    { residentId: string; residentName: string; entryDate: string },
    CensusReadmitResidentVariables,
    Resident
  >(OUTBOX_MUTATION_KEYS.censusReadmitResident, ({ residentId, residentName, entryDate }) => ({
    houseId,
    residentId,
    residentName,
    data: { houseId, entryDate },
  }));
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

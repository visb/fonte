import { useQuery } from '@tanstack/react-query';
import { ResidentStatus } from '@fonte/types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { OUTBOX_MUTATION_KEYS, useOutboxMutation } from '@/lib/offline/outbox';
import type { ResidentUpdateStatusVariables } from '@/lib/offline/mutationDefaults';

// Baixa de filho (alta, evasão, transferência). Story 196: saiu de
// `features/census/hooks/useCensus.ts` porque a ação deixou de ser exclusiva da
// contagem — agora também sai da lista de filhos.
//
// As `mutationKey`s NÃO mudaram junto com a pasta: chave trocada abandonaria na
// fila offline o lançamento pendente de quem atualizasse o app.

export function useHouses() {
  return useQuery({
    queryKey: queryKeys.houses.all,
    queryFn: () => api.houses.list(),
  });
}

// Discharge ("alta"): status DISCHARGED + exit date = event date.
export function useDischargeResident(houseId: string) {
  return useOutboxMutation<
    { residentId: string; exitDate: string },
    ResidentUpdateStatusVariables
  >(OUTBOX_MUTATION_KEYS.residentUpdateStatus, ({ residentId, exitDate }) => ({
    houseId,
    residentId,
    data: { status: ResidentStatus.DISCHARGED, exitDate },
  }));
}

// Evasion ("evasão"): status EVADED + exit date = event date.
export function useEvadeResident(houseId: string) {
  return useOutboxMutation<
    { residentId: string; exitDate: string },
    ResidentUpdateStatusVariables
  >(OUTBOX_MUTATION_KEYS.residentUpdateStatus, ({ residentId, exitDate }) => ({
    houseId,
    residentId,
    data: { status: ResidentStatus.EVADED, exitDate },
  }));
}

// Transfer: move the resident to another house, keeping the ACTIVE status.
export function useTransferResident(houseId: string) {
  return useOutboxMutation<
    { residentId: string; targetHouseId: string },
    ResidentUpdateStatusVariables
  >(OUTBOX_MUTATION_KEYS.residentUpdateStatus, ({ residentId, targetHouseId }) => ({
    houseId,
    residentId,
    data: { houseId: targetHouseId },
  }));
}

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { REMOVABLE_RESIDENT_STATUSES, type ResidentStatus } from '@fonte/types';
import type { MinistryLeaderType, Resident } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Story 204: a lista de servos da casa (`staff.byHouse`) traz os ministérios
 * que cada um lidera — mudar líder/criar/excluir ministério a deixa velha.
 */
function invalidateHouseStaff(queryClient: QueryClient, houseId: string) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.staff.byHouse(houseId) });
}

export function useMinistries(houseId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.ministries.byHouse(houseId!),
    queryFn: () => api.houses.listMinistries(houseId!),
    enabled: !!houseId,
  });
}

export function useMinistryDetail(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ministries.detail(id!),
    queryFn: () => api.ministries.getById(id!),
    enabled: !!id,
  });
}

export function useMinistryTasks(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.ministries.tasks(id!),
    queryFn: () => api.ministries.listTasks(id!),
    enabled: !!id,
  });
}

/**
 * Story 205 — filhos que podem entrar no ministério (ou liderá-lo): os da lista
 * da casa no **store local** (`residents.byHouse`, abre offline) filtrados para
 * quem está em acolhimento. O build antigo listava quem já tinha saído.
 */
export function useMinistryEligibleResidents(houseId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.residents.byHouse(houseId ?? ''),
    queryFn: () => api.residents.listByHouse(houseId as string),
    enabled: !!houseId,
    select: selectMinistryEligible,
  });
}

// A lista já é a da casa (`/houses/:id/residents` não devolve `houseId`): basta
// o status em acolhimento — mesma constante do backend.
function selectMinistryEligible(residents: Resident[]): Resident[] {
  return residents.filter((r) => REMOVABLE_RESIDENT_STATUSES.includes(r.status as ResidentStatus));
}

/** O que muda quando um filho entra/sai do ministério ou vira/deixa de ser líder. */
function invalidateMinistryResident(
  queryClient: QueryClient,
  ministryId: string,
  houseId: string,
  residentId?: string | null,
) {
  queryClient.invalidateQueries({ queryKey: queryKeys.ministries.detail(ministryId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.ministries.byHouse(houseId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.houses.ministries(houseId) });
  if (residentId) queryClient.invalidateQueries({ queryKey: queryKeys.residents.detail(residentId) });
}

// Story 205 — mutations de ministério EXIGEM rede (decisão 9): não são fluxo de
// campo da lista do CLAUDE.md, então não entram na fila offline; a tela
// desabilita a ação sem sinal.
export function useAddResident(ministryId: string, houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (residentId: string) => api.ministries.addResident(ministryId, residentId),
    onSuccess: (_data, residentId) =>
      invalidateMinistryResident(queryClient, ministryId, houseId, residentId),
  });
}

export function useRemoveResident(ministryId: string, houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (residentId: string) => api.ministries.removeResident(ministryId, residentId),
    onSuccess: (_data, residentId) =>
      invalidateMinistryResident(queryClient, ministryId, houseId, residentId),
  });
}

export function useCreateMinistry(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    // Sem `Promise.all` de N `addResident` fora de transação (decisão 7 da 197,
    // mantida na 205): cria + define o líder; filhos entram pela tela do ministério.
    mutationFn: async ({
      name,
      leaderId,
      leaderType,
    }: {
      name: string;
      leaderId?: string | null;
      leaderType?: MinistryLeaderType | null;
    }) => {
      const ministry = await api.houses.addMinistry(houseId, { name });
      if (leaderId && leaderType) {
        await api.ministries.update(ministry.id, { leaderId, leaderType });
      }
      return ministry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.byHouse(houseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.houses.ministries(houseId) });
      invalidateHouseStaff(queryClient, houseId);
    },
  });
}

export function useUpdateMinistry(ministryId: string, houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; leaderId?: string | null; leaderType?: MinistryLeaderType | null }) =>
      api.ministries.update(ministryId, data),
    onSuccess: () => {
      invalidateMinistryResident(queryClient, ministryId, houseId);
      invalidateHouseStaff(queryClient, houseId);
    },
  });
}

export function useDeleteMinistry(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ministryId: string) => api.ministries.delete(ministryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.byHouse(houseId) });
      invalidateHouseStaff(queryClient, houseId);
    },
  });
}

export function useAddStaff(ministryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (staffId: string) => api.ministries.addStaff(ministryId, staffId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.detail(ministryId) }),
  });
}

export function useRemoveStaff(ministryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (staffId: string) => api.ministries.removeStaff(ministryId, staffId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.detail(ministryId) }),
  });
}

export function useCreateTask(ministryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; repetition?: 'NONE' | 'DAILY' }) =>
      api.ministries.createTask(ministryId, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.tasks(ministryId) }),
  });
}

export function useUpdateTask(ministryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: { title?: string; completed?: boolean; repetition?: 'NONE' | 'DAILY' } }) =>
      api.ministries.updateTask(ministryId, taskId, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.tasks(ministryId) }),
  });
}

export function useDeleteTask(ministryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => api.ministries.deleteTask(ministryId, taskId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.tasks(ministryId) }),
  });
}

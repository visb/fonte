import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MinistryLeaderType } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { ministryEligibleResidents } from '../utils';

export function useHouseMinistriesList(houseId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.houses.ministries(houseId),
    queryFn: () => api.houses.listMinistries(houseId),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Story 205 — filhos da casa que podem entrar no ministério ou liderá-lo: só os
 * em acolhimento. Mesma query de `useHouseResidents` (cache compartilhado), com
 * o filtro no `select`.
 */
export function useMinistryEligibleResidents(houseId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.houses.residents(houseId),
    queryFn: () => api.houses.listResidents(houseId),
    enabled: options?.enabled ?? true,
    select: ministryEligibleResidents,
  });
}

export function useMinistryDetail(ministryId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.ministries.detail(ministryId ?? ''),
    queryFn: () => api.ministries.getById(ministryId!),
    enabled: !!ministryId && (options?.enabled ?? true),
  });
}

// Story 205 (decisão 7 da 197, mantida): sem `Promise.all` de N `addResident`
// fora de transação — o ministério nasce com nome e líder; os filhos entram
// depois, um a um, pelo dialog de filhos do ministério.
export function useCreateHouseMinistry(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.houses.ministries(houseId) }),
  });
}

export function useUpdateMinistryLeader(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      ministryId,
      leaderId,
      leaderType,
    }: {
      ministryId: string;
      leaderId: string | null;
      leaderType: MinistryLeaderType | null;
    }) => api.ministries.update(ministryId, { leaderId, leaderType }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.houses.ministries(houseId) }),
  });
}

function useInvalidateMinistryMembers(houseId: string, ministryId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.detail(ministryId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.houses.ministries(houseId) }),
      // A ficha do filho mostra o ministério (OverviewTab).
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.all }),
    ]);
}

export function useAddMinistryResident(houseId: string, ministryId: string) {
  const invalidate = useInvalidateMinistryMembers(houseId, ministryId);
  return useMutation({
    mutationFn: (residentId: string) => api.ministries.addResident(ministryId, residentId),
    onSuccess: invalidate,
  });
}

export function useRemoveMinistryResident(houseId: string, ministryId: string) {
  const invalidate = useInvalidateMinistryMembers(houseId, ministryId);
  return useMutation({
    mutationFn: (residentId: string) => api.ministries.removeResident(ministryId, residentId),
    onSuccess: invalidate,
  });
}

export function useRemoveMinistry(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ministryId: string) => api.ministries.delete(ministryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.houses.ministries(houseId) }),
  });
}

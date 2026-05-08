import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useHouseMinistriesList(houseId: string) {
  return useQuery({
    queryKey: queryKeys.houses.ministries(houseId),
    queryFn: () => api.houses.listMinistries(houseId),
  });
}

export function useAddMinistry(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { ministryId: string; leaderId?: string; leaderType?: 'STAFF' | 'RESIDENT' }) =>
      api.houses.addMinistry(houseId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.houses.ministries(houseId) }),
  });
}

export function useUpdateMinistryLeader(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ hmId, leaderId, leaderType }: { hmId: string; leaderId: string | null; leaderType: 'STAFF' | 'RESIDENT' | null }) =>
      api.houses.updateMinistry(houseId, hmId, { leaderId, leaderType }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.houses.ministries(houseId) }),
  });
}

export function useRemoveMinistry(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hmId: string) => api.houses.removeMinistry(houseId, hmId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.houses.ministries(houseId) }),
  });
}

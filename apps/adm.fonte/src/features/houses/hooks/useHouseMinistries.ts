import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useHouseMinistriesList(houseId: string) {
  return useQuery({
    queryKey: queryKeys.houses.ministries(houseId),
    queryFn: () => api.houses.listMinistries(houseId),
  });
}

export function useCreateHouseMinistry(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      leaderId,
      leaderType,
      residentIds = [],
    }: {
      name: string;
      leaderId?: string | null;
      leaderType?: 'STAFF' | 'RESIDENT' | null;
      residentIds?: string[];
    }) => {
      const ministry = await api.houses.addMinistry(houseId, { name });
      const followUps: Promise<unknown>[] = [];
      if (leaderId && leaderType) {
        followUps.push(api.ministries.update(ministry.id, { leaderId, leaderType }));
      }
      for (const residentId of residentIds) {
        followUps.push(api.ministries.addResident(ministry.id, residentId));
      }
      await Promise.all(followUps);
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
      leaderType: 'STAFF' | 'RESIDENT' | null;
    }) => api.ministries.update(ministryId, { leaderId, leaderType }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.houses.ministries(houseId) }),
  });
}

export function useRemoveMinistry(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ministryId: string) => api.ministries.delete(ministryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.houses.ministries(houseId) }),
  });
}

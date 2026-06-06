import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useCensusPending(houseId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.census.pending(houseId),
    queryFn: () => api.census.listPending(houseId),
    enabled: !!houseId && (options?.enabled ?? true),
  });
}

function useInvalidateAfterCensusReview(houseId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.census.pending(houseId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount });
    queryClient.invalidateQueries({ queryKey: queryKeys.residents.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.houses.all });
  };
}

export function useApproveAllCensus(houseId: string) {
  const invalidate = useInvalidateAfterCensusReview(houseId);
  return useMutation({
    mutationFn: () => api.census.approveAll(houseId),
    onSuccess: invalidate,
  });
}

export function useRejectCensusResident(houseId: string) {
  const invalidate = useInvalidateAfterCensusReview(houseId);
  return useMutation({
    mutationFn: (residentId: string) => api.census.reject(residentId),
    onSuccess: invalidate,
  });
}

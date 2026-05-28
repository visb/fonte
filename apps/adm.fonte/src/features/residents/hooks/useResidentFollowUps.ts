import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BulkCreateContributionsInput, CreateFollowUpInput } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useResidentFollowUps(residentId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.residents.followUps(residentId),
    queryFn: () => api.residents.getFollowUps(residentId),
    enabled: (options?.enabled ?? true) && !!residentId,
  });
}

export function useCreateFollowUp(residentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFollowUpInput) => api.residents.createFollowUp(residentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.followUps(residentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.detail(residentId) });
    },
  });
}

export function useBulkCreateContributions(residentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkCreateContributionsInput) =>
      api.residents.bulkCreateContributions(residentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.followUps(residentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.detail(residentId) });
    },
  });
}

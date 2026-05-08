import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { CreateHouseRuleInput } from '@fonte/api-client';

export function useHouseRules(houseId: string) {
  return useQuery({
    queryKey: queryKeys.houses.rules(houseId),
    queryFn: () => api.houses.listRules(houseId),
  });
}

export function useCreateRule(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateHouseRuleInput) => api.houses.createRule(houseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.houses.rules(houseId) });
    },
  });
}

export function useDeleteRule(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => api.houses.deleteRule(houseId, ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.houses.rules(houseId) });
    },
  });
}

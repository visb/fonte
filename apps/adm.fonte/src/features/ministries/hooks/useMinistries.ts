import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useMinistries(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.ministries.all,
    queryFn: () => api.ministries.list(),
    enabled: options?.enabled ?? true,
  });
}

export function useCreateMinistry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string }) => api.ministries.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.all });
    },
  });
}

export function useUpdateMinistry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string } }) =>
      api.ministries.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.all });
    },
  });
}

export function useDeleteMinistry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.ministries.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.all });
    },
  });
}

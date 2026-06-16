import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateAssociateInput, UpdateAssociateInput } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useAssociates() {
  return useQuery({
    queryKey: queryKeys.associates.all,
    queryFn: () => api.associates.list(),
  });
}

export function useAssociatesOverview(months = 12) {
  return useQuery({
    queryKey: queryKeys.associates.overview(months),
    queryFn: () => api.associates.getOverview(months),
  });
}

export function useAssociateById(id: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.associates.detail(id!),
    queryFn: () => api.associates.getById(id!),
    enabled: (options?.enabled ?? true) && !!id,
  });
}

export function useCreateAssociate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAssociateInput) => api.associates.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.associates.all }),
  });
}

export function useUpdateAssociate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAssociateInput }) =>
      api.associates.update(id, data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.detail(id) });
    },
  });
}

export function useDeleteAssociate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.associates.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.associates.all }),
  });
}

/** Cancela a recorrência de cartão do associado (admin faz por ele — sem login). */
export function useCancelAssociateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.associates.cancelSubscription(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.associates.detail(id) });
    },
  });
}

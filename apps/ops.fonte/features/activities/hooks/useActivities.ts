import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChangeActivityStatusInput,
  CreateActivityInput,
  UpdateActivityInput,
} from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Lista escopada: o backend já filtra pela casa do staff autenticado
 * (COORD/SERVANT só veem a própria casa). O houseId só governa o cache/enabled.
 */
export function useActivities(houseId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.activities.byHouse(houseId!),
    queryFn: () => api.activities.list(),
    enabled: !!houseId,
  });
}

export function useActivity(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.activities.detail(id!),
    queryFn: () => api.activities.getById(id!),
    enabled: !!id,
  });
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateActivityInput }) =>
      api.activities.update(id, data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activities.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.activities.detail(id) });
    },
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateActivityInput) => api.activities.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activities.all });
    },
  });
}

export function useChangeActivityStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ChangeActivityStatusInput }) =>
      api.activities.changeStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activities.all });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChangeActivityStatusInput,
  CreateActivityInput,
  ListActivitiesParams,
  UpdateActivityInput,
} from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useActivities(filters: ListActivitiesParams = {}) {
  return useQuery({
    queryKey: queryKeys.activities.list(filters),
    queryFn: () => api.activities.list(filters),
  });
}

export function useActivity(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.activities.detail(id),
    queryFn: () => api.activities.getById(id),
    enabled: !!id && (options?.enabled ?? true),
  });
}

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.activities.all });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateActivityInput) => api.activities.create(data),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateActivityInput }) =>
      api.activities.update(id, data),
    onSuccess: (_data, { id }) => {
      invalidateAll(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.activities.detail(id) });
    },
  });
}

export function useChangeActivityStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ChangeActivityStatusInput }) =>
      api.activities.changeStatus(id, data),
    onSuccess: (_data, { id }) => {
      invalidateAll(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.activities.detail(id) });
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.activities.remove(id),
    onSuccess: () => invalidateAll(queryClient),
  });
}

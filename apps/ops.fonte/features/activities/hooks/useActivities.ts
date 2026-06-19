import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChangeActivityStatusInput,
  CreateActivityCommentInput,
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

// ── comentários (story 65) ────────────────────────────────────────────────────

export function useActivityComments(activityId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.activities.comments(activityId!),
    queryFn: () => api.activities.listComments(activityId!),
    enabled: !!activityId,
  });
}

export function useAddComment(activityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateActivityCommentInput) =>
      api.activities.addComment(activityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.activities.comments(activityId),
      });
    },
  });
}

export function useDeleteComment(activityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      api.activities.deleteComment(activityId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.activities.comments(activityId),
      });
    },
  });
}

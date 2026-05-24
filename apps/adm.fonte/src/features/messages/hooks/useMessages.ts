import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.messages.conversations,
    queryFn: () => api.messages.getConversations(),
  });
}

export function useDirectConversations() {
  return useQuery({
    queryKey: queryKeys.messages.directConversations,
    queryFn: () => api.messages.getDirectConversations(),
  });
}

export function useThread(
  residentId: string | null,
  relativeId: string | null,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.messages.thread(residentId ?? '', relativeId ?? ''),
    queryFn: () => api.messages.getThread(residentId!, relativeId!),
    enabled: !!residentId && !!relativeId && (options?.enabled ?? true),
  });
}

export function useDirectThread(
  staffId: string | null,
  relativeId: string | null,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.messages.directThread(staffId ?? '', relativeId ?? ''),
    queryFn: () => api.messages.getDirectThread(staffId!, relativeId!),
    enabled: !!staffId && !!relativeId && (options?.enabled ?? true),
  });
}

export function useApproveMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.messages.approve(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.all }),
  });
}

export function useRejectMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.messages.reject(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.all }),
  });
}

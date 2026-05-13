import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SendMessageInput } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.messages.conversations,
    queryFn: () => api.messages.getConversations(),
  });
}

export function useMyConversations() {
  return useQuery({
    queryKey: queryKeys.messages.myConversations,
    queryFn: () => api.messages.getMyConversations(),
  });
}

export function useMessageThread(residentId: string, relativeId: string) {
  return useQuery({
    queryKey: queryKeys.messages.thread(residentId, relativeId),
    queryFn: () => api.messages.getThread(residentId, relativeId),
    enabled: !!residentId && !!relativeId,
  });
}

export function usePendingMessages() {
  return useQuery({
    queryKey: queryKeys.messages.pending,
    queryFn: () => api.messages.getPending(),
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SendMessageInput) => api.messages.send(data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.thread(vars.residentId, vars.relativeId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.conversations });
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.myConversations });
    },
  });
}

export function useApproveMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.messages.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.pending });
    },
  });
}

export function useRejectMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.messages.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.pending });
    },
  });
}

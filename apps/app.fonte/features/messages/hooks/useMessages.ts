import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useThread(residentId: string, relativeId: string) {
  return useQuery({
    queryKey: queryKeys.messages.thread(residentId, relativeId),
    queryFn: () => api.messages.getThread(residentId, relativeId),
    enabled: !!residentId && !!relativeId,
    refetchInterval: 15_000,
  });
}

export function useSendMessage(residentId: string, relativeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      api.messages.send({ residentId, relativeId, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.thread(residentId, relativeId),
      });
    },
  });
}

export function useHouseStaffThreads() {
  return useQuery({
    queryKey: queryKeys.messages.houseStaffThreads,
    queryFn: () => api.messages.getHouseStaffThreads(),
  });
}

export function useDirectThread(staffId: string, relativeId: string) {
  return useQuery({
    queryKey: queryKeys.messages.directThread(staffId, relativeId),
    queryFn: () => api.messages.getDirectThread(staffId, relativeId),
    enabled: !!staffId && !!relativeId,
    refetchInterval: 15_000,
  });
}

export function useSendDirectMessage(staffId: string, relativeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      api.messages.sendDirect({ staffId, relativeId, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.directThread(staffId, relativeId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.houseStaffThreads,
      });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateSupportGroupInput, UpdateSupportGroupInput } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useSupportGroups() {
  return useQuery({
    queryKey: queryKeys.supportGroups.all,
    queryFn: () => api.supportGroups.list(),
  });
}

export function useCreateSupportGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSupportGroupInput) => api.supportGroups.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.supportGroups.all }),
  });
}

export function useUpdateSupportGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSupportGroupInput }) =>
      api.supportGroups.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.supportGroups.all }),
  });
}

export function useDeleteSupportGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.supportGroups.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.supportGroups.all }),
  });
}

export function useSupportGroupMeetings(groupId: string | null) {
  return useQuery({
    queryKey: queryKeys.supportGroups.meetings(groupId!),
    queryFn: () => api.supportGroups.listMeetings(groupId!),
    enabled: !!groupId,
  });
}

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

export function useSupportGroupMeetingDetail(meetingId: string | null) {
  return useQuery({
    queryKey: queryKeys.supportGroups.meetingDetail(meetingId!),
    queryFn: () => api.supportGroups.getMeeting(meetingId!),
    enabled: !!meetingId,
  });
}

export function useMeetingRelativeCheckins(meetingId: string | null) {
  return useQuery({
    queryKey: queryKeys.supportGroups.relativeCheckins(meetingId!),
    queryFn: () => api.supportGroups.getMeetingRelativeCheckins(meetingId!),
    enabled: !!meetingId,
  });
}

export function useRelativeCheckinHistory(relativeId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.supportGroups.relativeHistory(relativeId!),
    queryFn: () => api.supportGroups.getRelativeCheckinHistory(relativeId!),
    enabled: (options?.enabled ?? true) && !!relativeId,
  });
}

export function useResidentCheckinHistory(residentId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.supportGroups.residentHistory(residentId!),
    queryFn: () => api.supportGroups.getResidentCheckinHistory(residentId!),
    enabled: (options?.enabled ?? true) && !!residentId,
  });
}

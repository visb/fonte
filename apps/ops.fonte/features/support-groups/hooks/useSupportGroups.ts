import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateMeetingInput, AddCheckinInput } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useSupportGroups() {
  return useQuery({
    queryKey: queryKeys.supportGroups.all,
    queryFn: () => api.supportGroups.list(),
  });
}

export function useAllMeetings() {
  return useQuery({
    queryKey: queryKeys.supportGroups.allMeetings,
    queryFn: () => api.supportGroups.listAllMeetings(),
  });
}

export function useMeetingDetail(meetingId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.supportGroups.meetingDetail(meetingId!),
    queryFn: () => api.supportGroups.getMeeting(meetingId!),
    enabled: !!meetingId,
  });
}

export function useCreateMeeting(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMeetingInput) => api.supportGroups.createMeeting(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.supportGroups.allMeetings });
      queryClient.invalidateQueries({ queryKey: queryKeys.supportGroups.meetings(groupId) });
    },
  });
}

export function useAddCheckin(meetingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AddCheckinInput) => api.supportGroups.addCheckin(meetingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.supportGroups.meetingDetail(meetingId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.supportGroups.allMeetings });
    },
  });
}

export function useRemoveCheckin(meetingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (checkinId: string) => api.supportGroups.removeCheckin(meetingId, checkinId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.supportGroups.meetingDetail(meetingId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.supportGroups.allMeetings });
    },
  });
}

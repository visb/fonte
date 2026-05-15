import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { MessageAttachment, SendPayload } from '../components/MessageInput';

async function uploadAttachment(att: MessageAttachment) {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    const blob = await fetch(att.uri).then((r) => r.blob());
    const mimeType = blob.type || att.mimeType;
    const ext = mimeType.split('/')[1]?.split(';')[0] ?? 'bin';
    const name = att.name.includes('.') ? att.name : `${att.name}.${ext}`;
    formData.append('file', new File([blob], name, { type: mimeType }));
  } else {
    formData.append('file', { uri: att.uri, type: att.mimeType, name: att.name } as unknown as Blob);
  }
  return api.messages.uploadAttachment(formData);
}

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
    mutationFn: async (payload: SendPayload) => {
      const calls = [];
      if (payload.content?.trim()) {
        calls.push(api.messages.send({ residentId, relativeId, content: payload.content }));
      }
      for (const att of payload.attachments ?? []) {
        calls.push(
          uploadAttachment(att).then((r) =>
            api.messages.send({ residentId, relativeId, attachmentUrl: r.url, attachmentType: r.type }),
          ),
        );
      }
      const results = await Promise.all(calls);
      return results[results.length - 1];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.thread(residentId, relativeId) });
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
    mutationFn: async (payload: SendPayload) => {
      const calls = [];
      if (payload.content?.trim()) {
        calls.push(api.messages.sendDirect({ staffId, relativeId, content: payload.content }));
      }
      for (const att of payload.attachments ?? []) {
        calls.push(
          uploadAttachment(att).then((r) =>
            api.messages.sendDirect({ staffId, relativeId, attachmentUrl: r.url, attachmentType: r.type }),
          ),
        );
      }
      const results = await Promise.all(calls);
      return results[results.length - 1];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.directThread(staffId, relativeId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.houseStaffThreads });
    },
  });
}

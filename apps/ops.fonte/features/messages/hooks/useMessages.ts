import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    mutationFn: async ({ residentId, relativeId, payload }: { residentId: string; relativeId: string; payload: SendPayload }) => {
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
    onSuccess: (_, { residentId, relativeId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.thread(residentId, relativeId) });
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

export function useDirectConversations() {
  return useQuery({
    queryKey: queryKeys.messages.directConversations,
    queryFn: () => api.messages.getDirectConversations(),
  });
}

export function useHouseRelativesForMessages(houseId: string | null | undefined) {
  return useQuery({
    queryKey: ['house-relatives-messages', houseId] as const,
    queryFn: async () => {
      const residents = await api.residents.listByHouse(houseId!);
      const groups = await Promise.all(
        residents.map((r) =>
          api.relatives.listByResident(r.id).then((rels) => ({
            residentId: r.id,
            residentName: r.name,
            relatives: rels,
          })),
        ),
      );
      return groups.filter((g) => g.relatives.length > 0);
    },
    enabled: !!houseId,
  });
}

export function useDirectThread(staffId: string, relativeId: string) {
  return useQuery({
    queryKey: queryKeys.messages.directThread(staffId, relativeId),
    queryFn: () => api.messages.getDirectThread(staffId, relativeId),
    enabled: !!staffId && !!relativeId,
  });
}

export function useSendDirectMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ staffId, relativeId, payload }: { staffId: string; relativeId: string; payload: SendPayload }) => {
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
    onSuccess: (_, { staffId, relativeId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.directThread(staffId, relativeId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.directConversations });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import type {
  ChangeActivityStatusInput,
  CreateActivityCommentInput,
  CreateActivityInput,
  UpdateActivityInput,
} from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/** Anexo escolhido pelo picker (story 73): uri local + metadados. */
export interface PickedAttachment {
  uri: string;
  mimeType: string;
  name: string;
}

/**
 * Monta o FormData multipart do anexo (mesmo padrão de message): no web busca o
 * blob da uri; no nativo passa { uri, type, name } direto ao RN.
 */
async function toAttachmentFormData(att: PickedAttachment): Promise<FormData> {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    const blob = await fetch(att.uri).then((r) => r.blob());
    const mimeType = blob.type || att.mimeType;
    const ext = mimeType.split('/')[1]?.split(';')[0] ?? 'bin';
    const name = att.name.includes('.') ? att.name : `${att.name}.${ext}`;
    formData.append('file', new File([blob], name, { type: mimeType }));
  } else {
    formData.append('file', {
      uri: att.uri,
      type: att.mimeType,
      name: att.name,
    } as unknown as Blob);
  }
  return formData;
}

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

// ── anexos (story 73) ───────────────────────────────────────────────────────

export function useUploadActivityAttachment(activityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (att: PickedAttachment) =>
      api.activities.uploadAttachment(activityId, await toAttachmentFormData(att)),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.activities.detail(activityId),
      });
    },
  });
}

export function useUploadCommentAttachment(activityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      commentId,
      att,
    }: {
      commentId: string;
      att: PickedAttachment;
    }) =>
      api.activities.uploadCommentAttachment(
        activityId,
        commentId,
        await toAttachmentFormData(att),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.activities.comments(activityId),
      });
    },
  });
}

export function useDeleteAttachment(activityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      api.activities.deleteAttachment(activityId, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.activities.detail(activityId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.activities.comments(activityId),
      });
    },
  });
}

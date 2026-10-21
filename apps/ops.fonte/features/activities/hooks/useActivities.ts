import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import type {
  Activity,
  ActivityComment,
  ChangeActivityStatusInput,
  CreateActivityCommentInput,
  CreateActivityInput,
  UpdateActivityInput,
} from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { OUTBOX_MUTATION_KEYS, useOutboxMutation } from '@/lib/offline/outbox';
import type {
  ActivityCommentVariables,
  ActivityCreateVariables,
} from '@/lib/offline/mutationDefaults';

/**
 * Anexo escolhido pelo picker ou gravado (story 73 + áudio 74): uri local +
 * metadados. `durationSeconds` só é enviado para áudio (o backend ignora os demais).
 */
export interface PickedAttachment {
  uri: string;
  mimeType: string;
  name: string;
  durationSeconds?: number | null;
}

/**
 * Monta o FormData multipart do anexo (mesmo padrão de message): no web busca o
 * blob da uri; no nativo passa { uri, type, name } direto ao RN. Anexa
 * `durationSeconds` quando informado (story 74).
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
  if (att.durationSeconds != null && Number.isFinite(att.durationSeconds)) {
    formData.append('durationSeconds', String(Math.round(att.durationSeconds)));
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

/**
 * Histórico da atividade (story 220): a trilha gravada pelo backend (story 66).
 * A key começa com `activities`, então entra na allowlist offline como o detalhe.
 */
export function useActivityEvents(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.activities.events(id!),
    queryFn: () => api.activities.listEvents(id!),
    enabled: !!id,
  });
}

/**
 * Editar conteúdo ou trocar o responsável (story 220). Trocar responsável exige
 * rede: o endpoint não aceita `Idempotency-Key`, então não entra na outbox.
 */
export function useUpdateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateActivityInput }) =>
      api.activities.update(id, data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activities.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.activities.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.activities.events(id) });
    },
  });
}

/** Atividade é fluxo de campo: outbox (story 169). */
export function useCreateActivity() {
  return useOutboxMutation<CreateActivityInput, ActivityCreateVariables, Activity>(
    OUTBOX_MUTATION_KEYS.activityCreate,
    (data) => ({ data }),
  );
}

export function useChangeActivityStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ChangeActivityStatusInput }) =>
      api.activities.changeStatus(id, data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activities.all });
      // A aprovação pode atribuir o responsável (story 220): o histórico muda.
      queryClient.invalidateQueries({ queryKey: queryKeys.activities.events(id) });
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
  return useOutboxMutation<CreateActivityCommentInput, ActivityCommentVariables, ActivityComment>(
    OUTBOX_MUTATION_KEYS.activityComment,
    (data) => ({ activityId, data }),
  );
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

import type { AxiosInstance } from 'axios';
import type {
  Activity,
  CreateActivityInput,
  UpdateActivityInput,
  ChangeActivityStatusInput,
  ListActivitiesParams,
  ActivityComment,
  CreateActivityCommentInput,
  ActivityEvent,
  ActivityAttachment,
} from '../types.js';

export function createActivitiesModule(http: AxiosInstance) {
  return {
    list: (params?: ListActivitiesParams) =>
      http.get<Activity[]>('/activities', { params }).then((r) => r.data),

    getById: (id: string) =>
      http.get<Activity>(`/activities/${id}`).then((r) => r.data),

    create: (data: CreateActivityInput) =>
      http.post<Activity>('/activities', data).then((r) => r.data),

    update: (id: string, data: UpdateActivityInput) =>
      http.patch<Activity>(`/activities/${id}`, data).then((r) => r.data),

    changeStatus: (id: string, data: ChangeActivityStatusInput) =>
      http.patch<Activity>(`/activities/${id}/status`, data).then((r) => r.data),

    remove: (id: string) =>
      http.delete(`/activities/${id}`).then((r) => r.data),

    // ── comentários (story 65) ───────────────────────────────────────────────
    listComments: (activityId: string) =>
      http
        .get<ActivityComment[]>(`/activities/${activityId}/comments`)
        .then((r) => r.data),

    addComment: (activityId: string, data: CreateActivityCommentInput) =>
      http
        .post<ActivityComment>(`/activities/${activityId}/comments`, data)
        .then((r) => r.data),

    deleteComment: (activityId: string, commentId: string) =>
      http
        .delete(`/activities/${activityId}/comments/${commentId}`)
        .then((r) => r.data),

    // ── histórico de eventos (story 66) ──────────────────────────────────────
    listEvents: (activityId: string) =>
      http
        .get<ActivityEvent[]>(`/activities/${activityId}/events`)
        .then((r) => r.data),

    // ── anexos (story 73) ────────────────────────────────────────────────────
    /** Anexa um arquivo à atividade. Recebe FormData com o campo `file`. */
    uploadAttachment: (activityId: string, formData: FormData) =>
      http
        .post<ActivityAttachment>(`/activities/${activityId}/attachments`, formData, {
          headers: { 'Content-Type': undefined },
        })
        .then((r) => r.data),

    /** Anexa um arquivo a um comentário. Recebe FormData com o campo `file`. */
    uploadCommentAttachment: (
      activityId: string,
      commentId: string,
      formData: FormData,
    ) =>
      http
        .post<ActivityAttachment>(
          `/activities/${activityId}/comments/${commentId}/attachments`,
          formData,
          { headers: { 'Content-Type': undefined } },
        )
        .then((r) => r.data),

    /** Exclui um anexo (da atividade ou de comentário). */
    deleteAttachment: (activityId: string, attachmentId: string) =>
      http
        .delete(`/activities/${activityId}/attachments/${attachmentId}`)
        .then((r) => r.data),
  };
}

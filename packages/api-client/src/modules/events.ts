import type { AxiosInstance } from 'axios';
import type {
  Event,
  CreateEventInput,
  UpdateEventInput,
  ListEventsParams,
} from '../types.js';

export function createEventsModule(http: AxiosInstance) {
  return {
    list: (params?: ListEventsParams) =>
      http.get<Event[]>('/events', { params }).then((r) => r.data),

    getById: (id: string) =>
      http.get<Event>(`/events/${id}`).then((r) => r.data),

    create: (data: CreateEventInput) =>
      http.post<Event>('/events', data).then((r) => r.data),

    update: (id: string, data: UpdateEventInput) =>
      http.patch<Event>(`/events/${id}`, data).then((r) => r.data),

    remove: (id: string) =>
      http.delete(`/events/${id}`).then((r) => r.data),

    /** Anexa/substitui o banner. Recebe FormData com o campo `file`. */
    uploadBanner: (id: string, formData: FormData) =>
      http
        .post<Event>(`/events/${id}/banner`, formData, {
          headers: { 'Content-Type': undefined },
        })
        .then((r) => r.data),
  };
}

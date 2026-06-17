import type { AxiosInstance } from 'axios';
import type {
  Event,
  CreateEventInput,
  UpdateEventInput,
  ListEventsParams,
  EventPublic,
  EventRegistration,
  RegisterToEventInput,
  EventRegistrationResult,
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

    /** Inscritos de um evento (ADMIN/COORDINATOR). */
    listRegistrations: (id: string) =>
      http.get<EventRegistration[]>(`/events/${id}/registrations`).then((r) => r.data),

    /** Endpoints públicos (sem auth) — usados pelo portal. */
    public: {
      list: () => http.get<EventPublic[]>('/public/events').then((r) => r.data),

      getById: (id: string) =>
        http.get<EventPublic>(`/public/events/${id}`).then((r) => r.data),

      register: (id: string, data: RegisterToEventInput) =>
        http
          .post<EventRegistrationResult>(`/public/events/${id}/register`, data)
          .then((r) => r.data),
    },
  };
}

import type { AxiosInstance } from 'axios';
import type { Incident, CreateIncidentInput } from '../types.js';

export function createIncidentsModule(http: AxiosInstance) {
  return {
    list: (params?: { houseId?: string; residentId?: string }) =>
      http.get<Incident[]>('/incidents', { params }).then((r) => r.data),
    getById: (id: string) => http.get<Incident>(`/incidents/${id}`).then((r) => r.data),
    create: (data: CreateIncidentInput) =>
      http.post<Incident>('/incidents', data).then((r) => r.data),
  };
}

import type { AxiosInstance } from 'axios';
import type { Incident, CreateIncidentInput } from '../types.js';
import { requestConfig, type RequestOptions } from '../request-options.js';

export function createIncidentsModule(http: AxiosInstance) {
  return {
    list: (params?: { houseId?: string; residentId?: string }) =>
      http.get<Incident[]>('/incidents', { params }).then((r) => r.data),
    getById: (id: string) => http.get<Incident>(`/incidents/${id}`).then((r) => r.data),
    create: (data: CreateIncidentInput, options?: RequestOptions) =>
      http.post<Incident>('/incidents', data, ...requestConfig(options)).then((r) => r.data),
  };
}

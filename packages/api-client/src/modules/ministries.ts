import type { AxiosInstance } from 'axios';
import type { Ministry, CreateMinistryInput, UpdateMinistryInput } from '../types.js';

export function createMinistriesModule(http: AxiosInstance) {
  return {
    list: () => http.get<Ministry[]>('/ministries').then((r) => r.data),
    getById: (id: string) => http.get<Ministry>(`/ministries/${id}`).then((r) => r.data),
    create: (data: CreateMinistryInput) =>
      http.post<Ministry>('/ministries', data).then((r) => r.data),
    update: (id: string, data: UpdateMinistryInput) =>
      http.patch<Ministry>(`/ministries/${id}`, data).then((r) => r.data),
    delete: (id: string) => http.delete(`/ministries/${id}`),
  };
}

import type { AxiosInstance } from 'axios';
import type { Relative, CreateRelativeInput } from '../types.js';

export function createRelativesModule(http: AxiosInstance) {
  return {
    listByResident: (residentId: string) =>
      http.get<Relative[]>('/relatives', { params: { residentId } }).then((r) => r.data),
    create: (data: CreateRelativeInput) =>
      http.post<Relative>('/relatives', data).then((r) => r.data),
    delete: (id: string) => http.delete(`/relatives/${id}`),
  };
}

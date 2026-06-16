import type { AxiosInstance } from 'axios';
import type {
  AssociateListItem,
  AssociateDetail,
  Associate,
  CreateAssociateInput,
  UpdateAssociateInput,
} from '../types.js';

export function createAssociatesModule(http: AxiosInstance) {
  return {
    list: () => http.get<AssociateListItem[]>('/associates').then((r) => r.data),

    getById: (id: string) =>
      http.get<AssociateDetail>(`/associates/${id}`).then((r) => r.data),

    create: (data: CreateAssociateInput) =>
      http.post<Associate>('/associates', data).then((r) => r.data),

    update: (id: string, data: UpdateAssociateInput) =>
      http.patch<Associate>(`/associates/${id}`, data).then((r) => r.data),

    remove: (id: string) => http.delete(`/associates/${id}`).then((r) => r.data),
  };
}

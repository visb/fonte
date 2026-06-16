import type { AxiosInstance } from 'axios';
import type {
  AssociateListItem,
  AssociateDetail,
  Associate,
  AssociatePublicView,
  CreateAssociateInput,
  UpdateAssociateInput,
  SubscribeInput,
  SubscribeResult,
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

    // ── Checkout público (story 38 — consumido pela página pública [[40]]) ──────
    // Acesso por payment_token, sem JWT.
    public: {
      getByToken: (token: string) =>
        http
          .get<AssociatePublicView>(`/public/associates/${token}`)
          .then((r) => r.data),

      subscribe: (token: string, data: SubscribeInput) =>
        http
          .post<SubscribeResult>(`/public/associates/${token}/subscribe`, data)
          .then((r) => r.data),
    },
  };
}

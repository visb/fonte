import type { AxiosInstance } from 'axios';
import type {
  AssociateCancelView,
  AssociateDetail,
  Associate,
  AssociatePublicView,
  AssociateSubscription,
  AssociatesOverview,
  PaginatedAssociates,
  CreateAssociateInput,
  UpdateAssociateInput,
  SubscribeInput,
  SubscribeResult,
} from '../types.js';

export function createAssociatesModule(http: AxiosInstance) {
  return {
    /** Lista paginada de associados (story 46 — scroll infinito). */
    list: (params?: { limit?: number; offset?: number }) =>
      http
        .get<PaginatedAssociates>('/associates', { params })
        .then((r) => r.data),

    /** Overview de faturamento (esperado vs arrecadado por mês + índices). ADMIN. */
    getOverview: (months?: number) =>
      http
        .get<AssociatesOverview>('/associates/overview', {
          params: months !== undefined ? { months } : undefined,
        })
        .then((r) => r.data),

    getById: (id: string) =>
      http.get<AssociateDetail>(`/associates/${id}`).then((r) => r.data),

    create: (data: CreateAssociateInput) =>
      http.post<Associate>('/associates', data).then((r) => r.data),

    update: (id: string, data: UpdateAssociateInput) =>
      http.patch<Associate>(`/associates/${id}`, data).then((r) => r.data),

    remove: (id: string) => http.delete(`/associates/${id}`).then((r) => r.data),

    /** Cancela a recorrência de cartão do associado (admin). */
    cancelSubscription: (id: string) =>
      http
        .post<AssociateSubscription>(`/associates/${id}/cancel-subscription`)
        .then((r) => r.data),

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

      // ── Autocancelamento público (story 45) — acesso por payment_token ────────
      getCancelView: (token: string) =>
        http
          .get<AssociateCancelView>(`/public/associates/${token}/cancel-view`)
          .then((r) => r.data),

      cancelByToken: (token: string) =>
        http
          .post<AssociateCancelView>(`/public/associates/${token}/cancel`)
          .then((r) => r.data),
    },
  };
}

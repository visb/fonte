import type { AxiosInstance } from 'axios';
import type {
  Payable,
  PayablesSummary,
  CreatePayableInput,
  UpdatePayableInput,
  PayPayableInput,
  ListPayablesParams,
  PayablesSummaryParams,
} from '../types.js';

export function createPayablesModule(http: AxiosInstance) {
  return {
    list: (params?: ListPayablesParams) =>
      http.get<Payable[]>('/payables', { params }).then((r) => r.data),

    summary: (params?: PayablesSummaryParams) =>
      http.get<PayablesSummary>('/payables/summary', { params }).then((r) => r.data),

    getById: (id: string) =>
      http.get<Payable>(`/payables/${id}`).then((r) => r.data),

    create: (data: CreatePayableInput) =>
      http.post<Payable>('/payables', data).then((r) => r.data),

    update: (id: string, data: UpdatePayableInput) =>
      http.patch<Payable>(`/payables/${id}`, data).then((r) => r.data),

    pay: (id: string, data?: PayPayableInput) =>
      http.patch<Payable>(`/payables/${id}/pay`, data ?? {}).then((r) => r.data),

    remove: (id: string) =>
      http.delete(`/payables/${id}`).then((r) => r.data),
  };
}

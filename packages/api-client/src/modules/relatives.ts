import type { AxiosInstance } from 'axios';
import type {
  Relative,
  RelativeMe,
  RelativePaidReceivable,
  CreateRelativeInput,
  UpdateRelativeMeInput,
  GenerateRelativeAccessInput,
  ResetRelativePasswordInput,
} from '../types.js';

export function createRelativesModule(http: AxiosInstance) {
  return {
    me: (): Promise<RelativeMe> =>
      http.get<RelativeMe>('/relatives/me').then((r) => r.data),
    updateMe: (data: UpdateRelativeMeInput): Promise<RelativeMe> =>
      http.patch<RelativeMe>('/relatives/me', data).then((r) => r.data),
    uploadPhotoMe: (formData: FormData): Promise<RelativeMe> =>
      http
        .post<RelativeMe>('/relatives/me/photo', formData, { headers: { 'Content-Type': undefined } })
        .then((r) => r.data),
    /**
     * Story 193 — parcelas PAGAS do filho do familiar logado (role RELATIVE).
     * Só o que já foi pago: o app do familiar não cobra (decisão 11).
     */
    myPaidReceivables: (): Promise<RelativePaidReceivable[]> =>
      http.get<RelativePaidReceivable[]>('/relatives/me/receivables').then((r) => r.data),

    /**
     * Story 193 — PDF do recibo de uma parcela paga do PRÓPRIO filho.
     *
     * `responseType` é parâmetro (e não constante) porque os dois consumidores
     * precisam de coisas diferentes: o React Native não tem `Blob` que sirva
     * para escrever arquivo e pede `arraybuffer` (o app converte para base64 e
     * grava no cache); a web pede `blob`. Um cliente HTTP só, dois consumos.
     */
    receivableReceipt: (
      receivableId: string,
      options?: { responseType?: 'blob' | 'arraybuffer' },
    ): Promise<Blob | ArrayBuffer> =>
      http
        .get<Blob | ArrayBuffer>(`/relatives/me/receivables/${receivableId}/receipt`, {
          responseType: options?.responseType ?? 'blob',
        })
        .then((r) => r.data),

    listByResident: (residentId: string): Promise<Relative[]> =>
      http.get<Relative[]>('/relatives', { params: { residentId } }).then((r) => r.data),
    create: (data: CreateRelativeInput): Promise<Relative> =>
      http.post<Relative>('/relatives', data).then((r) => r.data),
    setResponsible: (id: string): Promise<Relative> =>
      http.patch<Relative>(`/relatives/${id}/responsible`).then((r) => r.data),
    delete: (id: string) => http.delete(`/relatives/${id}`),
    generateAccess: (id: string, data: GenerateRelativeAccessInput): Promise<Relative> =>
      http.post<Relative>(`/relatives/${id}/access`, data).then((r) => r.data),
    resetPassword: (id: string, data: ResetRelativePasswordInput): Promise<void> =>
      http.post<void>(`/relatives/${id}/access/reset-password`, data).then(() => undefined),
  };
}

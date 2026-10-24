import type { AxiosInstance } from 'axios';
import type { Staff, StaffMe, CreateStaffInput, UpdateStaffInput, UpdateStaffMeInput, StaffPermission, AddStaffPermissionInput } from '../types.js';
import type {
  CreateServicePeriodPayload,
  DismissStaffPayload,
  ReinstateStaffPayload,
  StaffListParams,
  StaffAttachment,
  StaffPermissionType,
  StaffServicePeriod,
  UpdateServicePeriodPayload,
} from '@fonte/types';

export function createStaffModule(http: AxiosInstance) {
  return {
    me: () => http.get<StaffMe>('/staff/me').then((r) => r.data),
    updateMe: (data: UpdateStaffMeInput): Promise<StaffMe> =>
      http.patch<StaffMe>('/staff/me', data).then((r) => r.data),
    uploadPhotoMe: (formData: FormData): Promise<StaffMe> =>
      http.post<StaffMe>('/staff/me/photo', formData, { headers: { 'Content-Type': undefined } }).then((r) => r.data),
    // Story 128 — assinatura desenhada no perfil (PNG transparente). FormData
    // com o Blob, mesma convenção de upload de foto.
    uploadMySignature: (formData: FormData): Promise<StaffMe> =>
      http.post<StaffMe>('/staff/me/signature', formData, { headers: { 'Content-Type': undefined } }).then((r) => r.data),
    // Story 138 — redefine (remove) a assinatura do próprio perfil. Idempotente
    // no backend; devolve o StaffMe atualizado (signatureUrl null).
    removeMySignature: (): Promise<StaffMe> =>
      http.delete<StaffMe>('/staff/me/signature').then((r) => r.data),
    // Story 217 — sem `status` o backend devolve só os ativos (não desligados).
    // Story 223 — `search`/`houseId`; params vazios não vão na query string.
    list: (params?: StaffListParams) => {
      const query = Object.fromEntries(
        Object.entries(params ?? {}).filter(([, value]) => typeof value === 'string' && value.trim() !== ''),
      );
      return (Object.keys(query).length
        ? http.get<Staff[]>('/staff', { params: query })
        : http.get<Staff[]>('/staff')
      ).then((r) => r.data);
    },
    getById: (id: string) => http.get<Staff>(`/staff/${id}`).then((r) => r.data),
    create: (data: CreateStaffInput) => http.post<Staff>('/staff', data).then((r) => r.data),
    update: (id: string, data: UpdateStaffInput) =>
      http.patch<Staff>(`/staff/${id}`, data).then((r) => r.data),
    uploadPhoto: (id: string, formData: FormData) =>
      http
        .post<Staff>(`/staff/${id}/photo`, formData, { headers: { 'Content-Type': undefined } })
        .then((r) => r.data),
    delete: (id: string) => http.delete(`/staff/${id}`),
    // Story 217 — desligamento e reintegração (só ADMIN).
    dismiss: (id: string, payload: DismissStaffPayload): Promise<Staff> =>
      http.post<Staff>(`/staff/${id}/dismiss`, payload).then((r) => r.data),
    reinstate: (id: string, payload: ReinstateStaffPayload): Promise<Staff> =>
      http.post<Staff>(`/staff/${id}/reinstate`, payload).then((r) => r.data),

    listAttachments: (id: string): Promise<StaffAttachment[]> =>
      http.get<StaffAttachment[]>(`/staff/${id}/attachments`).then((r) => r.data),
    uploadAttachment: (id: string, formData: FormData): Promise<StaffAttachment> =>
      http
        .post<StaffAttachment>(`/staff/${id}/attachments`, formData, { headers: { 'Content-Type': undefined } })
        .then((r) => r.data),
    deleteAttachment: (id: string, attachmentId: string): Promise<void> =>
      http.delete(`/staff/${id}/attachments/${attachmentId}`).then(() => undefined),

    // Story 216 — períodos de serviço da aba Histórico (escrita só ADMIN).
    listServicePeriods: (id: string): Promise<StaffServicePeriod[]> =>
      http.get<StaffServicePeriod[]>(`/staff/${id}/service-periods`).then((r) => r.data),
    createServicePeriod: (id: string, payload: CreateServicePeriodPayload): Promise<StaffServicePeriod> =>
      http.post<StaffServicePeriod>(`/staff/${id}/service-periods`, payload).then((r) => r.data),
    updateServicePeriod: (
      id: string,
      periodId: string,
      payload: UpdateServicePeriodPayload,
    ): Promise<StaffServicePeriod> =>
      http.patch<StaffServicePeriod>(`/staff/${id}/service-periods/${periodId}`, payload).then((r) => r.data),

    getPermissions: (id: string): Promise<StaffPermission[]> =>
      http.get<StaffPermission[]>(`/staff/${id}/permissions`).then((r) => r.data),
    addPermission: (id: string, data: AddStaffPermissionInput): Promise<StaffPermission> =>
      http.post<StaffPermission>(`/staff/${id}/permissions`, data).then((r) => r.data),
    removePermission: (id: string, type: StaffPermissionType): Promise<void> =>
      http.delete(`/staff/${id}/permissions/${type}`).then(() => undefined),
  };
}

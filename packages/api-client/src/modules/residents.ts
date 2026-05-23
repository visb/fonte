import type { AxiosInstance } from 'axios';
import type {
  Admission,
  CreateFollowUpInput,
  GenerateResidentAccessInput,
  ListResidentsParams,
  PaginatedResponse,
  ReadmitResidentInput,
  Resident,
  ResidentFollowUp,
  ResidentMe,
  ResetResidentPasswordInput,
  CreateResidentInput,
  UpdateResidentInput,
  ResidentDocument,
  ResidentAttachment,
} from '../types.js';

export function createResidentsModule(http: AxiosInstance) {
  return {
    list: (params?: ListResidentsParams) =>
      http.get<PaginatedResponse<Resident>>('/residents', { params }).then((r) => r.data),
    listByHouse: (houseId: string) =>
      http.get<Resident[]>(`/houses/${houseId}/residents`).then((r) => r.data),
    getById: (id: string) => http.get<Resident>(`/residents/${id}`).then((r) => r.data),
    create: (data: CreateResidentInput) =>
      http.post<Resident>('/residents', data).then((r) => r.data),
    update: (id: string, data: UpdateResidentInput) =>
      http.patch<Resident>(`/residents/${id}`, data).then((r) => r.data),
    delete: (id: string) => http.delete(`/residents/${id}`),
    uploadPhoto: (id: string, formData: FormData) =>
      http
        .post(`/residents/${id}/photo`, formData, { headers: { 'Content-Type': undefined } })
        .then((r) => r.data),
    getDocuments: (id: string) =>
      http.get<ResidentDocument[]>(`/residents/${id}/documents`).then((r) => r.data),
    renderDocument: (id: string, templateId: string) =>
      http.get<string>(`/residents/${id}/documents/${templateId}/render`).then((r) => r.data),
    downloadDocumentPdf: (id: string, templateId: string) =>
      http
        .get<Blob>(`/residents/${id}/documents/${templateId}/pdf`, { responseType: 'blob' })
        .then((r) => r.data),
    getAttachments: (id: string) =>
      http.get<ResidentAttachment[]>(`/residents/${id}/attachments`).then((r) => r.data),
    addAttachment: (id: string, formData: FormData) =>
      http
        .post<ResidentAttachment>(`/residents/${id}/attachments`, formData, {
          headers: { 'Content-Type': undefined },
        })
        .then((r) => r.data),
    deleteAttachment: (id: string, attachmentId: string) =>
      http.delete(`/residents/${id}/attachments/${attachmentId}`),
    uploadSignedDocument: (id: string, templateId: string, formData: FormData) =>
      http
        .post(`/residents/${id}/documents/${templateId}/signed`, formData, {
          headers: { 'Content-Type': undefined },
        })
        .then((r) => r.data),
    readmit: (id: string, data: ReadmitResidentInput): Promise<Resident> =>
      http.post<Resident>(`/residents/${id}/readmit`, data).then((r) => r.data),

    getAdmissions: (id: string): Promise<Admission[]> =>
      http.get<Admission[]>(`/residents/${id}/admissions`).then((r) => r.data),

    getFollowUps: (id: string): Promise<ResidentFollowUp[]> =>
      http.get<ResidentFollowUp[]>(`/residents/${id}/follow-ups`).then((r) => r.data),

    createFollowUp: (id: string, data: CreateFollowUpInput): Promise<ResidentFollowUp> =>
      http.post<ResidentFollowUp>(`/residents/${id}/follow-ups`, data).then((r) => r.data),

    uploadFollowUpAttachment: (id: string, followUpId: string, formData: FormData): Promise<ResidentFollowUp> =>
      http
        .post<ResidentFollowUp>(`/residents/${id}/follow-ups/${followUpId}/attachment`, formData, {
          headers: { 'Content-Type': undefined },
        })
        .then((r) => r.data),

    me: (): Promise<ResidentMe> => http.get<ResidentMe>('/residents/me').then((r) => r.data),
    uploadPhotoMe: (formData: FormData): Promise<ResidentMe> =>
      http
        .post<ResidentMe>('/residents/me/photo', formData, { headers: { 'Content-Type': undefined } })
        .then((r) => r.data),
    generateAccess: (id: string, data: GenerateResidentAccessInput): Promise<Resident> =>
      http.post<Resident>(`/residents/${id}/access`, data).then((r) => r.data),
    resetPassword: (id: string, data: ResetResidentPasswordInput): Promise<void> =>
      http.post(`/residents/${id}/access/reset-password`, data).then(() => undefined),
  };
}

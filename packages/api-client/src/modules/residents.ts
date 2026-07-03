import type { AxiosInstance } from 'axios';
import type {
  Admission,
  BulkCreateContributionsInput,
  CreateFollowUpInput,
  GenerateResidentAccessInput,
  PromoteToServantInput,
  Staff,
  ListResidentsParams,
  PaginatedResponse,
  ParseDocxResult,
  ParseSpreadsheetResult,
  ReadmitResidentInput,
  Resident,
  ResidentFollowUp,
  ResidentMe,
  ResetResidentPasswordInput,
  CreateResidentInput,
  UpdateResidentInput,
  ResidentDocument,
  ResidentAttachment,
  AdmissionDocument,
  ContributionsReportResponse,
  GetContributionsReportParams,
  ResidentReceivable,
  UpdateContributionPlanInput,
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
    getAdmissionDocuments: (id: string) =>
      http.get<AdmissionDocument[]>(`/residents/${id}/admission-documents`).then((r) => r.data),
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

    contributionsReport: (params: GetContributionsReportParams): Promise<ContributionsReportResponse> =>
      http.get<ContributionsReportResponse>('/residents/contributions/report', { params }).then((r) => r.data),

    getReceivables: (id: string): Promise<ResidentReceivable[]> =>
      http.get<ResidentReceivable[]>(`/residents/${id}/receivables`).then((r) => r.data),

    registerReceivablePayment: (id: string, receivableId: string, formData: FormData): Promise<ResidentReceivable> =>
      http
        .post<ResidentReceivable>(`/residents/${id}/receivables/${receivableId}/payment`, formData, {
          headers: { 'Content-Type': undefined },
        })
        .then((r) => r.data),

    reopenReceivable: (id: string, receivableId: string): Promise<ResidentReceivable> =>
      http.post<ResidentReceivable>(`/residents/${id}/receivables/${receivableId}/reopen`, {}).then((r) => r.data),

    updateContributionPlan: (id: string, data: UpdateContributionPlanInput): Promise<Resident> =>
      http.patch<Resident>(`/residents/${id}/contribution-plan`, data).then((r) => r.data),

    setContributionExempt: (id: string, exempt: boolean): Promise<Resident> =>
      http.patch<Resident>(`/residents/${id}/contribution-exempt`, { exempt }).then((r) => r.data),

    parseDocx: (formData: FormData): Promise<ParseDocxResult> =>
      http
        .post<ParseDocxResult>('/residents/import/parse-docx', formData, { headers: { 'Content-Type': undefined } })
        .then((r) => r.data),

    parseSpreadsheet: (formData: FormData): Promise<ParseSpreadsheetResult> =>
      http
        .post<ParseSpreadsheetResult>('/residents/import/parse-spreadsheet', formData, {
          headers: { 'Content-Type': undefined },
        })
        .then((r) => r.data),

    bulkCreateContributions: (id: string, data: BulkCreateContributionsInput): Promise<{ created: number; skipped: number }> =>
      http.post(`/residents/${id}/follow-ups/bulk-contributions`, data).then((r) => r.data),

    me: (): Promise<ResidentMe> => http.get<ResidentMe>('/residents/me').then((r) => r.data),
    uploadPhotoMe: (formData: FormData): Promise<ResidentMe> =>
      http
        .post<ResidentMe>('/residents/me/photo', formData, { headers: { 'Content-Type': undefined } })
        .then((r) => r.data),
    generateAccess: (id: string, data: GenerateResidentAccessInput): Promise<Resident> =>
      http.post<Resident>(`/residents/${id}/access`, data).then((r) => r.data),
    resetPassword: (id: string, data: ResetResidentPasswordInput): Promise<void> =>
      http.post(`/residents/${id}/access/reset-password`, data).then(() => undefined),
    promoteToServant: (id: string, data: PromoteToServantInput): Promise<Staff> =>
      http.post<Staff>(`/residents/${id}/promote-to-servant`, data).then((r) => r.data),

    // LGPD — direitos do titular.
    exportData: (id: string): Promise<Record<string, unknown>> =>
      http.get<Record<string, unknown>>(`/residents/${id}/data-export`).then((r) => r.data),
    anonymize: (id: string): Promise<{ anonymized: boolean; residentId: string }> =>
      http.post(`/residents/${id}/anonymize`, {}).then((r) => r.data),
  };
}

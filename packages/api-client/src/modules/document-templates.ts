import type { AxiosInstance } from 'axios';
import type {
  DocumentTemplate,
  CreateDocumentTemplateInput,
  UpdateDocumentTemplateInput,
} from '../types.js';

export function createDocumentTemplatesModule(http: AxiosInstance) {
  return {
    list: () => http.get<DocumentTemplate[]>('/document-templates').then((r) => r.data),
    getById: (id: string) =>
      http.get<DocumentTemplate>(`/document-templates/${id}`).then((r) => r.data),
    create: (data: CreateDocumentTemplateInput) =>
      http.post<DocumentTemplate>('/document-templates', data).then((r) => r.data),
    update: (id: string, data: UpdateDocumentTemplateInput) =>
      http.put<DocumentTemplate>(`/document-templates/${id}`, data).then((r) => r.data),
    delete: (id: string) => http.delete(`/document-templates/${id}`),
    uploadImage: (formData: FormData): Promise<{ url: string }> =>
      http
        .post<{ url: string }>('/document-templates/images', formData, {
          headers: { 'Content-Type': undefined },
        })
        .then((r) => r.data),
  };
}

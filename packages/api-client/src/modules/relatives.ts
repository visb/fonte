import type { AxiosInstance } from 'axios';
import type {
  Relative,
  RelativeMe,
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
    listByResident: (residentId: string): Promise<Relative[]> =>
      http.get<Relative[]>('/relatives', { params: { residentId } }).then((r) => r.data),
    create: (data: CreateRelativeInput): Promise<Relative> =>
      http.post<Relative>('/relatives', data).then((r) => r.data),
    delete: (id: string) => http.delete(`/relatives/${id}`),
    generateAccess: (id: string, data: GenerateRelativeAccessInput): Promise<Relative> =>
      http.post<Relative>(`/relatives/${id}/access`, data).then((r) => r.data),
    resetPassword: (id: string, data: ResetRelativePasswordInput): Promise<void> =>
      http.post<void>(`/relatives/${id}/access/reset-password`, data).then(() => undefined),
  };
}

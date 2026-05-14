import type { AxiosInstance } from 'axios';
import type { Staff, StaffMe, CreateStaffInput, UpdateStaffInput } from '../types.js';

export function createStaffModule(http: AxiosInstance) {
  return {
    me: () => http.get<StaffMe>('/staff/me').then((r) => r.data),
    list: () => http.get<Staff[]>('/staff').then((r) => r.data),
    getById: (id: string) => http.get<Staff>(`/staff/${id}`).then((r) => r.data),
    create: (data: CreateStaffInput) => http.post<Staff>('/staff', data).then((r) => r.data),
    update: (id: string, data: UpdateStaffInput) =>
      http.patch<Staff>(`/staff/${id}`, data).then((r) => r.data),
    uploadPhoto: (id: string, formData: FormData) =>
      http
        .post<Staff>(`/staff/${id}/photo`, formData, { headers: { 'Content-Type': undefined } })
        .then((r) => r.data),
    delete: (id: string) => http.delete(`/staff/${id}`),
  };
}

import type { AxiosInstance } from 'axios';
import type { Staff, StaffMe, CreateStaffInput, UpdateStaffInput, UpdateStaffMeInput, StaffPermission, AddStaffPermissionInput } from '../types.js';
import type { StaffPermissionType } from '@fonte/types';

export function createStaffModule(http: AxiosInstance) {
  return {
    me: () => http.get<StaffMe>('/staff/me').then((r) => r.data),
    updateMe: (data: UpdateStaffMeInput): Promise<StaffMe> =>
      http.patch<StaffMe>('/staff/me', data).then((r) => r.data),
    uploadPhotoMe: (formData: FormData): Promise<StaffMe> =>
      http.post<StaffMe>('/staff/me/photo', formData, { headers: { 'Content-Type': undefined } }).then((r) => r.data),
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

    getPermissions: (id: string): Promise<StaffPermission[]> =>
      http.get<StaffPermission[]>(`/staff/${id}/permissions`).then((r) => r.data),
    addPermission: (id: string, data: AddStaffPermissionInput): Promise<StaffPermission> =>
      http.post<StaffPermission>(`/staff/${id}/permissions`, data).then((r) => r.data),
    removePermission: (id: string, type: StaffPermissionType): Promise<void> =>
      http.delete(`/staff/${id}/permissions/${type}`).then(() => undefined),
  };
}

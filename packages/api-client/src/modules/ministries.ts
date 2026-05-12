import type { AxiosInstance } from 'axios';
import type {
  MinistryDetail,
  MinistryTask,
  UpdateMinistryInput,
  CreateMinistryTaskInput,
  UpdateMinistryTaskInput,
} from '../types.js';

export function createMinistriesModule(http: AxiosInstance) {
  return {
    getById: (id: string) =>
      http.get<MinistryDetail>(`/ministries/${id}`).then((r) => r.data),
    update: (id: string, data: UpdateMinistryInput) =>
      http.patch<MinistryDetail>(`/ministries/${id}`, data).then((r) => r.data),
    delete: (id: string) => http.delete(`/ministries/${id}`),

    addResident: (id: string, residentId: string) =>
      http.post(`/ministries/${id}/residents`, { residentId }),
    removeResident: (id: string, residentId: string) =>
      http.delete(`/ministries/${id}/residents/${residentId}`),

    addStaff: (id: string, staffId: string) =>
      http.post(`/ministries/${id}/staff`, { staffId }),
    removeStaff: (id: string, staffId: string) =>
      http.delete(`/ministries/${id}/staff/${staffId}`),

    listTasks: (id: string) =>
      http.get<MinistryTask[]>(`/ministries/${id}/tasks`).then((r) => r.data),
    createTask: (id: string, data: CreateMinistryTaskInput) =>
      http.post<MinistryTask>(`/ministries/${id}/tasks`, data).then((r) => r.data),
    updateTask: (id: string, taskId: string, data: UpdateMinistryTaskInput) =>
      http.patch<MinistryTask>(`/ministries/${id}/tasks/${taskId}`, data).then((r) => r.data),
    deleteTask: (id: string, taskId: string) =>
      http.delete(`/ministries/${id}/tasks/${taskId}`),
  };
}

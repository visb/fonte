import type { AxiosInstance } from 'axios';
import type {
  Activity,
  CreateActivityInput,
  UpdateActivityInput,
  ChangeActivityStatusInput,
  ListActivitiesParams,
} from '../types.js';

export function createActivitiesModule(http: AxiosInstance) {
  return {
    list: (params?: ListActivitiesParams) =>
      http.get<Activity[]>('/activities', { params }).then((r) => r.data),

    getById: (id: string) =>
      http.get<Activity>(`/activities/${id}`).then((r) => r.data),

    create: (data: CreateActivityInput) =>
      http.post<Activity>('/activities', data).then((r) => r.data),

    update: (id: string, data: UpdateActivityInput) =>
      http.patch<Activity>(`/activities/${id}`, data).then((r) => r.data),

    changeStatus: (id: string, data: ChangeActivityStatusInput) =>
      http.patch<Activity>(`/activities/${id}/status`, data).then((r) => r.data),

    remove: (id: string) =>
      http.delete(`/activities/${id}`).then((r) => r.data),
  };
}

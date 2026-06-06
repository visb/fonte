import type { AxiosInstance } from 'axios';
import type {
  House,
  CreateHouseInput,
  UpdateHouseInput,
  HousePhoto,
  HouseMinistry,
  AddMinistryInput,
  HouseRule,
  CreateHouseRuleInput,
  HouseCapacityRequest,
  CreateCapacityRequestInput,
  Resident,
  Staff,
} from '../types.js';

export function createHousesModule(http: AxiosInstance) {
  return {
    list: () => http.get<House[]>('/houses').then((r) => r.data),
    getById: (id: string) => http.get<House>(`/houses/${id}`).then((r) => r.data),
    create: (data: CreateHouseInput) => http.post<House>('/houses', data).then((r) => r.data),
    update: (id: string, data: UpdateHouseInput) =>
      http.patch<House>(`/houses/${id}`, data).then((r) => r.data),
    delete: (id: string) => http.delete(`/houses/${id}`),
    addPhoto: (id: string, formData: FormData) =>
      http
        .post<HousePhoto>(`/houses/${id}/photos`, formData, {
          headers: { 'Content-Type': undefined },
        })
        .then((r) => r.data),
    deletePhoto: (id: string, photoId: string) =>
      http.delete(`/houses/${id}/photos/${photoId}`),
    listResidents: (id: string) =>
      http.get<Resident[]>(`/houses/${id}/residents`).then((r) => r.data),
    listStaff: (id: string) =>
      http.get<Staff[]>(`/houses/${id}/staff`).then((r) => r.data),
    listMinistries: (id: string) =>
      http.get<HouseMinistry[]>(`/houses/${id}/ministries`).then((r) => r.data),
    addMinistry: (id: string, data: AddMinistryInput) =>
      http.post<HouseMinistry>(`/houses/${id}/ministries`, data).then((r) => r.data),
    listRules: (id: string) =>
      http.get<HouseRule[]>(`/houses/${id}/rules`).then((r) => r.data),
    createRule: (id: string, data: CreateHouseRuleInput) =>
      http.post<HouseRule>(`/houses/${id}/rules`, data).then((r) => r.data),
    deleteRule: (id: string, ruleId: string) =>
      http.delete(`/houses/${id}/rules/${ruleId}`),
    // ─── Pedidos de alteração de capacidade (ops → adm) ───────────────────────
    createCapacityRequest: (id: string, data: CreateCapacityRequestInput) =>
      http
        .post<HouseCapacityRequest>(`/houses/${id}/capacity-requests`, data)
        .then((r) => r.data),
    listCapacityRequests: (id: string) =>
      http
        .get<HouseCapacityRequest[]>(`/houses/${id}/capacity-requests`)
        .then((r) => r.data),
    getCapacityRequest: (requestId: string) =>
      http
        .get<HouseCapacityRequest>(`/house-capacity-requests/${requestId}`)
        .then((r) => r.data),
    approveCapacityRequest: (requestId: string) =>
      http
        .patch<HouseCapacityRequest>(`/house-capacity-requests/${requestId}/approve`)
        .then((r) => r.data),
    rejectCapacityRequest: (requestId: string) =>
      http
        .patch<HouseCapacityRequest>(`/house-capacity-requests/${requestId}/reject`)
        .then((r) => r.data),
  };
}

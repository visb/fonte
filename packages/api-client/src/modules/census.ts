import type { AxiosInstance } from 'axios';
import type {
  Resident,
  CreateResidentInput,
  CensusConcludeInput,
  CensusPendingResident,
} from '../types.js';

export function createCensusModule(http: AxiosInstance) {
  return {
    // Coordenador adiciona um filho na contagem (status CENSUS_ADDED + aviso ao ADM).
    addResident: (data: CreateResidentInput) =>
      http.post<Resident>('/census/residents', data).then((r) => r.data),
    // Coordenador conclui a contagem (gera notificação ao ADM).
    conclude: (data: CensusConcludeInput) =>
      http.post<{ addedCount: number }>('/census/conclude', data).then((r) => r.data),
    // ADM lista os filhos adicionados aguardando revisão.
    listPending: (houseId: string) =>
      http
        .get<CensusPendingResident[]>(`/census/houses/${houseId}/pending`)
        .then((r) => r.data),
    // ADM aprova todos os pendentes da casa (→ ACTIVE).
    approveAll: (houseId: string) =>
      http
        .post<{ approved: number }>(`/census/houses/${houseId}/approve-all`)
        .then((r) => r.data),
    // ADM nega um filho adicionado na contagem (→ REJECTED_CENSUS).
    reject: (residentId: string) =>
      http.patch<Resident>(`/census/residents/${residentId}/reject`).then((r) => r.data),
  };
}

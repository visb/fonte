import type { AxiosInstance } from 'axios';
import type {
  SupplyRoomItem,
  CreateSupplyItemInput,
  UpdateSupplyItemInput,
  SupplyRoomMovement,
  CreateSupplyMovementInput,
} from '../types.js';

export function createSupplyRoomModule(http: AxiosInstance) {
  return {
    listItems: (params?: { houseId?: string }) =>
      http.get<SupplyRoomItem[]>('/supply-room/items', { params }).then((r) => r.data),
    createItem: (data: CreateSupplyItemInput) =>
      http.post<SupplyRoomItem>('/supply-room/items', data).then((r) => r.data),
    updateItem: (id: string, data: UpdateSupplyItemInput) =>
      http.patch<SupplyRoomItem>(`/supply-room/items/${id}`, data).then((r) => r.data),
    deleteItem: (id: string) => http.delete(`/supply-room/items/${id}`),
    listMovements: (params?: { houseId?: string; itemId?: string }) =>
      http.get<SupplyRoomMovement[]>('/supply-room/movements', { params }).then((r) => r.data),
    createMovement: (data: CreateSupplyMovementInput) =>
      http.post<SupplyRoomMovement>('/supply-room/movements', data).then((r) => r.data),
  };
}

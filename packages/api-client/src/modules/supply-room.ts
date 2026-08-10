import type { AxiosInstance } from 'axios';
import type {
  SupplyRoomItem,
  CreateSupplyItemInput,
  UpdateSupplyItemInput,
  SupplyRoomMovement,
  CreateSupplyMovementInput,
} from '../types.js';
import { requestConfig, type RequestOptions } from '../request-options.js';

export function createSupplyRoomModule(http: AxiosInstance) {
  return {
    listItems: (params?: { houseId?: string }) =>
      http.get<SupplyRoomItem[]>('/supply-room/items', { params }).then((r) => r.data),
    createItem: (data: CreateSupplyItemInput, options?: RequestOptions) =>
      http
        .post<SupplyRoomItem>('/supply-room/items', data, ...requestConfig(options))
        .then((r) => r.data),
    updateItem: (id: string, data: UpdateSupplyItemInput) =>
      http.patch<SupplyRoomItem>(`/supply-room/items/${id}`, data).then((r) => r.data),
    deleteItem: (id: string) => http.delete(`/supply-room/items/${id}`),
    listMovements: (params?: { houseId?: string; itemId?: string }) =>
      http.get<SupplyRoomMovement[]>('/supply-room/movements', { params }).then((r) => r.data),
    createMovement: (data: CreateSupplyMovementInput, options?: RequestOptions) =>
      http
        .post<SupplyRoomMovement>('/supply-room/movements', data, ...requestConfig(options))
        .then((r) => r.data),
  };
}

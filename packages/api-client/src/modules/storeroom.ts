import type { AxiosInstance } from 'axios';
import type {
  StoreroomItem,
  CreateItemInput,
  UpdateItemInput,
  StoreroomMovement,
  CreateMovementInput,
} from '../types.js';
import { requestConfig, type RequestOptions } from '../request-options.js';

export function createStoreroomModule(http: AxiosInstance) {
  return {
    listItems: (params?: { houseId?: string }) =>
      http.get<StoreroomItem[]>('/storerooms/items', { params }).then((r) => r.data),
    createItem: (data: CreateItemInput, options?: RequestOptions) =>
      http
        .post<StoreroomItem>('/storerooms/items', data, ...requestConfig(options))
        .then((r) => r.data),
    updateItem: (id: string, data: UpdateItemInput) =>
      http.patch<StoreroomItem>(`/storerooms/items/${id}`, data).then((r) => r.data),
    deleteItem: (id: string) => http.delete(`/storerooms/items/${id}`),
    listMovements: (params?: { houseId?: string; itemId?: string }) =>
      http.get<StoreroomMovement[]>('/storerooms/movements', { params }).then((r) => r.data),
    createMovement: (data: CreateMovementInput, options?: RequestOptions) =>
      http
        .post<StoreroomMovement>('/storerooms/movements', data, ...requestConfig(options))
        .then((r) => r.data),
  };
}

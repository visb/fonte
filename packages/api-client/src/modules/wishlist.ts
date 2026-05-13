import type { AxiosInstance } from 'axios';
import type { AddWishlistItemInput, RejectWishlistItemInput, WishlistItem, WishlistPendingItem } from '../types.js';

export function createWishlistModule(http: AxiosInstance) {
  return {
    getItems: (residentId: string): Promise<WishlistItem[]> =>
      http.get<WishlistItem[]>(`/wishlist/${residentId}`).then((r) => r.data),
    getPending: (): Promise<WishlistPendingItem[]> =>
      http.get<WishlistPendingItem[]>('/wishlist/pending').then((r) => r.data),
    addItem: (residentId: string, data: AddWishlistItemInput): Promise<WishlistItem> =>
      http.post<WishlistItem>(`/wishlist/${residentId}/items`, data).then((r) => r.data),
    removeItem: (residentId: string, itemId: string): Promise<void> =>
      http.delete(`/wishlist/${residentId}/items/${itemId}`).then(() => undefined),
    approve: (itemId: string): Promise<WishlistItem> =>
      http.patch<WishlistItem>(`/wishlist/items/${itemId}/approve`).then((r) => r.data),
    reject: (itemId: string, data?: RejectWishlistItemInput): Promise<WishlistItem> =>
      http.patch<WishlistItem>(`/wishlist/items/${itemId}/reject`, data ?? {}).then((r) => r.data),
  };
}

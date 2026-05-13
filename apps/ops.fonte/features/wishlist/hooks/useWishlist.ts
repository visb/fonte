import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AddWishlistItemInput, RejectWishlistItemInput } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useWishlistItems(residentId: string) {
  return useQuery({
    queryKey: queryKeys.wishlist.items(residentId),
    queryFn: () => api.wishlist.getItems(residentId),
    enabled: !!residentId,
  });
}

export function usePendingWishlistItems() {
  return useQuery({
    queryKey: queryKeys.wishlist.pending,
    queryFn: () => api.wishlist.getPending(),
  });
}

export function useAddWishlistItem(residentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AddWishlistItemInput) => api.wishlist.addItem(residentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.items(residentId) });
    },
  });
}

export function useRemoveWishlistItem(residentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => api.wishlist.removeItem(residentId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.items(residentId) });
    },
  });
}

export function useApproveWishlistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => api.wishlist.approve(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.pending });
    },
  });
}

export function useRejectWishlistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data?: RejectWishlistItemInput }) =>
      api.wishlist.reject(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.pending });
    },
  });
}

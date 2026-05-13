import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useWishlistItems(residentId: string) {
  return useQuery({
    queryKey: queryKeys.wishlist.byResident(residentId),
    queryFn: () => api.wishlist.getItems(residentId),
    enabled: !!residentId,
  });
}

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useHouseMinistries(
  houseId: string | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.houses.ministries(houseId!),
    queryFn: () => api.houses.listMinistries(houseId!),
    enabled: (options?.enabled ?? true) && !!houseId,
  });
}

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { mergePendingContributions } from '@/lib/offline/productContributions';
import type { HouseProductContributionView } from '@fonte/types';

export function currentContributionMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export function useHouseProductContributions(houseId: string | null | undefined, month = currentContributionMonth()) {
  const client = useQueryClient();
  const key = queryKeys.houses.productContributions(houseId!, month);
  return useQuery({
    queryKey: key,
    queryFn: async () => mergePendingContributions(
      await api.houses.productContributions(houseId!, { referenceMonth: month }),
      client.getQueryData<HouseProductContributionView[]>(key),
    ),
    enabled: !!houseId,
  });
}

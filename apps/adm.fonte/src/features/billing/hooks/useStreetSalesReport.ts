import { useQuery } from '@tanstack/react-query';
import type { StreetSaleType } from '@fonte/types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useStreetSalesReport(params: { type: StreetSaleType; month: string; houseId?: string }) {
  return useQuery({
    queryKey: queryKeys.billing.streetSales.report(params),
    queryFn: () => api.streetSales.report(params),
  });
}

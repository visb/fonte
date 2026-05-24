import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useContributionsReport(params: { month: string; houseId?: string }) {
  return useQuery({
    queryKey: queryKeys.billing.filhos.report(params),
    queryFn: () => api.residents.contributionsReport(params),
  });
}

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useDocumentTemplates() {
  return useQuery({
    queryKey: queryKeys.documentTemplates.all,
    queryFn: () => api.documentTemplates.list(),
  });
}

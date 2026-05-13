import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useRelativeMe() {
  return useQuery({
    queryKey: queryKeys.relativeMe,
    queryFn: () => api.relatives.me(),
    staleTime: 5 * 60_000,
  });
}

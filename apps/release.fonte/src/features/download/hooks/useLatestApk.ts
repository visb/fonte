import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { fetchLatestApk } from '../lib/latestApk';

export function useLatestApk() {
  return useQuery({
    queryKey: queryKeys.latestApk,
    queryFn: () => fetchLatestApk(),
  });
}

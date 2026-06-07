import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useBackups() {
  return useQuery({
    queryKey: queryKeys.backup.all,
    queryFn: () => api.backup.list(),
  });
}

export function useRunBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.backup.run(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.backup.all }),
  });
}

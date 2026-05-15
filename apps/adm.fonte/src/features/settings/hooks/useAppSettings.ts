import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateAppSettingsInput } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useAppSettings() {
  return useQuery({
    queryKey: queryKeys.appSettings.current,
    queryFn: () => api.appSettings.get(),
  });
}

export function useUpdateAppSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateAppSettingsInput) => api.appSettings.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.appSettings.current });
    },
  });
}

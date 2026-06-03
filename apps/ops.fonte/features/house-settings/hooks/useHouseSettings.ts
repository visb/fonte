import { Platform } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { UpdateHouseInput } from '@fonte/api-client';

export function useHouseById(id: string | null | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.houses.detail(id ?? ''),
    queryFn: () => api.houses.getById(id as string),
    enabled: !!id && (options?.enabled ?? true),
  });
}

export function useUpdateHouse(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateHouseInput) => api.houses.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.houses.detail(id) });
    },
  });
}

export function useAddHousePhoto(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ uri, type }: { uri: string; type: string }) => {
      const fd = new FormData();
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        fd.append('file', blob, 'photo.jpg');
      } else {
        fd.append('file', { uri, name: 'photo.jpg', type } as unknown as Blob);
      }
      return api.houses.addPhoto(id, fd as unknown as globalThis.FormData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.houses.detail(id) });
    },
  });
}

export function useRemoveHousePhoto(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => api.houses.deletePhoto(id, photoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.houses.detail(id) });
    },
  });
}

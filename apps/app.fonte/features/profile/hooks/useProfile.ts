import { Platform } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { UpdateRelativeMeInput } from '@fonte/api-client';

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateRelativeMeInput) => api.relatives.updateMe(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.relativeMe, updated);
    },
  });
}

export function useUploadProfilePhoto() {
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
      return api.relatives.uploadPhotoMe(fd as unknown as globalThis.FormData);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.relativeMe, updated);
    },
  });
}

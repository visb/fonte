import { Platform } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { UpdateStaffMeInput } from '@fonte/api-client';

export function useUpdateStaffProfile() {
  return useMutation({
    mutationFn: (data: UpdateStaffMeInput) => api.staff.updateMe(data),
  });
}

export function useUploadStaffPhoto() {
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
      return api.staff.uploadPhotoMe(fd as unknown as globalThis.FormData);
    },
  });
}

export function useUploadResidentPhoto() {
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
      return api.residents.uploadPhotoMe(fd as unknown as globalThis.FormData);
    },
  });
}

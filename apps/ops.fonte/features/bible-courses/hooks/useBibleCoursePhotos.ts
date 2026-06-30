import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/** Foto escolhida pelo image picker do device: uri local + metadados. */
export interface PickedClassPhoto {
  uri: string;
  mimeType: string;
  name: string;
}

/**
 * Monta o FormData multipart da foto (mesmo padrão dos anexos de atividade): no
 * web busca o blob da uri; no nativo passa { uri, type, name } direto ao RN.
 */
export async function toClassPhotoFormData(photo: PickedClassPhoto): Promise<FormData> {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    const blob = await fetch(photo.uri).then((r) => r.blob());
    const mimeType = blob.type || photo.mimeType;
    const ext = mimeType.split('/')[1]?.split(';')[0] ?? 'jpg';
    const name = photo.name.includes('.') ? photo.name : `${photo.name}.${ext}`;
    formData.append('file', new File([blob], name, { type: mimeType }));
  } else {
    formData.append('file', {
      uri: photo.uri,
      type: photo.mimeType,
      name: photo.name,
    } as unknown as Blob);
  }
  return formData;
}

/** Galeria de fotos de uma turma do curso bíblico (story 92). */
export function useBibleCourseClassPhotos(classId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.bibleCourses.photos(classId!),
    queryFn: () => api.bibleCourse.listClassPhotos(classId!),
    enabled: !!classId,
  });
}

export function useUploadBibleCourseClassPhoto(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (photo: PickedClassPhoto) =>
      api.bibleCourse.uploadClassPhoto(classId, await toClassPhotoFormData(photo)),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.bibleCourses.photos(classId),
      }),
  });
}

export function useDeleteBibleCourseClassPhoto(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => api.bibleCourse.deleteClassPhoto(classId, photoId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.bibleCourses.photos(classId),
      }),
  });
}

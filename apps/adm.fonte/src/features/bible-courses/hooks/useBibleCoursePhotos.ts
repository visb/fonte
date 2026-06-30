import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Galeria de fotos de uma turma do curso bíblico (story 92). Query + mutations de
 * upload/remoção no mesmo arquivo; mutations invalidam a key da galeria.
 */
export function useBibleCourseClassPhotos(classId: string | null) {
  return useQuery({
    queryKey: queryKeys.bibleCourses.photos(classId!),
    queryFn: () => api.bibleCourse.listClassPhotos(classId!),
    enabled: !!classId,
  });
}

export function useUploadBibleCourseClassPhoto(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.bibleCourse.uploadClassPhoto(classId, formData);
    },
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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateBibleCourseModuleInput,
  UpdateBibleCourseModuleInput,
} from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useBibleModules() {
  return useQuery({
    queryKey: queryKeys.bibleCourses.modules,
    queryFn: () => api.bibleCourse.listModules(),
  });
}

export function useCreateBibleModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBibleCourseModuleInput) => api.bibleCourse.createModule(data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.modules }),
  });
}

export function useUpdateBibleModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBibleCourseModuleInput }) =>
      api.bibleCourse.updateModule(id, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.modules }),
  });
}

export function useDeleteBibleModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.bibleCourse.deleteModule(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.modules }),
  });
}

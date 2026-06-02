import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateBibleCourseClassInput,
  UpdateBibleCourseClassInput,
  EnrollResidentInput,
  UpdateBibleCourseEnrollmentInput,
} from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useBibleClasses(status?: string) {
  return useQuery({
    queryKey: queryKeys.bibleCourses.list(status),
    queryFn: () => api.bibleCourse.listClasses(status),
  });
}

export function useBibleClassById(id: string | null) {
  return useQuery({
    queryKey: queryKeys.bibleCourses.detail(id!),
    queryFn: () => api.bibleCourse.getClass(id!),
    enabled: !!id,
  });
}

export function useCreateBibleClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBibleCourseClassInput) => api.bibleCourse.createClass(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.all }),
  });
}

export function useUpdateBibleClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBibleCourseClassInput }) =>
      api.bibleCourse.updateClass(id, data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.detail(id) });
    },
  });
}

export function useDeleteBibleClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.bibleCourse.deleteClass(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.all }),
  });
}

export function useEnrollResident(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: EnrollResidentInput) => api.bibleCourse.enroll(classId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.detail(classId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.all });
    },
  });
}

export function useUpdateEnrollment(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBibleCourseEnrollmentInput }) =>
      api.bibleCourse.updateEnrollment(id, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.detail(classId) }),
  });
}

export function useRemoveEnrollment(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.bibleCourse.removeEnrollment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.detail(classId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.all });
    },
  });
}

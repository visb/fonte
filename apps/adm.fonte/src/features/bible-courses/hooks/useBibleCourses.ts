import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateBibleCourseClassInput,
  UpdateBibleCourseClassInput,
  EnrollResidentInput,
  UpdateBibleCourseEnrollmentInput,
} from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { toastError, toastSuccess } from '@/lib/toast';

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.all });
      toastSuccess('Turma criada.');
    },
    onError: (error) => toastError(error, 'Erro ao salvar turma.'),
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
      toastSuccess('Turma atualizada.');
    },
    onError: (error) => toastError(error, 'Erro ao salvar turma.'),
  });
}

export function useDeleteBibleClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.bibleCourse.deleteClass(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.all });
      toastSuccess('Turma excluída.');
    },
    onError: (error) => toastError(error, 'Erro ao excluir turma.'),
  });
}

export function useEligibleResidents(options?: { enabled?: boolean; months?: number }) {
  return useQuery({
    queryKey: queryKeys.bibleCourses.eligibleResidents(options?.months),
    queryFn: () => api.bibleCourse.listEligibleResidents(options?.months),
    enabled: options?.enabled ?? true,
  });
}

export function useEnrollBulk(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (residentIds: string[]) => api.bibleCourse.enrollBulk(classId, residentIds),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.detail(classId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.all });
      toastSuccess(`${result.enrolled} filho(s) matriculado(s).`);
    },
    onError: (error) => toastError(error, 'Erro ao matricular.'),
  });
}

export function useEnrollResident(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: EnrollResidentInput) => api.bibleCourse.enroll(classId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.detail(classId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.all });
      toastSuccess('Filho matriculado.');
    },
    onError: (error) => toastError(error, 'Erro ao matricular.'),
  });
}

export function useUpdateEnrollment(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBibleCourseEnrollmentInput }) =>
      api.bibleCourse.updateEnrollment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.detail(classId) });
      toastSuccess('Matrícula atualizada.');
    },
    onError: (error) => toastError(error, 'Erro ao atualizar matrícula.'),
  });
}

export function useRemoveEnrollment(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.bibleCourse.removeEnrollment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.detail(classId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.all });
      toastSuccess('Matrícula removida.');
    },
    onError: (error) => toastError(error, 'Erro ao remover matrícula.'),
  });
}

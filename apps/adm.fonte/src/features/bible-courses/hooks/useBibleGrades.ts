import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpsertBibleGradeInput } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useBibleClassGrades(classId: string | null) {
  return useQuery({
    queryKey: queryKeys.bibleCourses.grades(classId!),
    queryFn: () => api.bibleCourse.getClassGrades(classId!),
    enabled: !!classId,
  });
}

export function useUpsertBibleGrade(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      enrollmentId,
      moduleId,
      data,
    }: {
      enrollmentId: string;
      moduleId: string;
      data: UpsertBibleGradeInput;
    }) => api.bibleCourse.upsertGrade(enrollmentId, moduleId, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.grades(classId) }),
  });
}

/** Persiste as notas de um módulo em lote (uma chamada por aluno alterado). */
export function useUpsertBibleGradesBulk(classId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      moduleId,
      changes,
    }: {
      moduleId: string;
      changes: { enrollmentId: string; data: UpsertBibleGradeInput }[];
    }) => {
      for (const change of changes) {
        await api.bibleCourse.upsertGrade(change.enrollmentId, moduleId, change.data);
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.grades(classId) }),
  });
}

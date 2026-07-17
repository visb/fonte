import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateBibleCourseClassInput,
  UpdateBibleCourseClassInput,
  EnrollResidentInput,
  UpdateBibleCourseEnrollmentInput,
} from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { toastAction, toastError, toastSuccess } from '@/lib/toast';

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

// ── curso feito fora do sistema (story 127) ──────────────────────────────────

/** Argumento das mutations: o nome vai para a mensagem do toast. */
interface ExternalCompletionVars {
  residentId: string;
  residentName: string;
}

/**
 * Marcação de curso feito fora do sistema, para a ficha do filho. O endpoint é
 * ADMIN/COORDINATOR — o consumidor desliga a query (`enabled`) para quem não
 * pode gerenciar, em vez de tomar 403.
 */
export function useResidentExternalCompletion(
  residentId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.bibleCourses.externalCompletion(residentId),
    queryFn: () => api.bibleCourse.getExternalCompletion(residentId),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Desfaz a marcação. Dois caminhos chegam aqui (decisão 5 da story 127): a ação
 * "Desfazer" do toast, logo após marcar, e o botão permanente na ficha do filho.
 */
export function useUnmarkExternalCompletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ residentId }: ExternalCompletionVars) =>
      api.bibleCourse.unmarkExternalCompletion(residentId),
    onSuccess: (_data, { residentId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.eligibleResidentsAll });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bibleCourses.externalCompletion(residentId),
      });
      toastSuccess('Marcação removida.');
    },
    onError: (error) => toastError(error, 'Erro ao remover marcação.'),
  });
}

/**
 * Marca que o filho já fez o curso fora do sistema. O filho sai das sugestões
 * (invalida os elegíveis) e a ficha passa a mostrar o fato (invalida a ficha).
 * O toast traz "Desfazer" para o engano na hora (decisão 5).
 */
export function useMarkExternalCompletion() {
  const queryClient = useQueryClient();
  const unmark = useUnmarkExternalCompletion();
  return useMutation({
    mutationFn: ({ residentId }: ExternalCompletionVars) =>
      api.bibleCourse.markExternalCompletion(residentId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bibleCourses.eligibleResidentsAll });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bibleCourses.externalCompletion(vars.residentId),
      });
      toastAction(`${vars.residentName} marcado como já fez o curso.`, {
        label: 'Desfazer',
        onClick: () => unmark.mutate(vars),
      });
    },
    onError: (error) => toastError(error, 'Erro ao marcar o curso como já feito.'),
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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    bibleCourse: {
      listClasses: vi.fn(),
      getClass: vi.fn(),
      createClass: vi.fn(),
      updateClass: vi.fn(),
      deleteClass: vi.fn(),
      enroll: vi.fn(),
      enrollBulk: vi.fn(),
      listEligibleResidents: vi.fn(),
      updateEnrollment: vi.fn(),
      removeEnrollment: vi.fn(),
      getClassGrades: vi.fn(),
      upsertGrade: vi.fn(),
      listModules: vi.fn(),
      createModule: vi.fn(),
      updateModule: vi.fn(),
      deleteModule: vi.fn(),
      markExternalCompletion: vi.fn(),
      unmarkExternalCompletion: vi.fn(),
      getExternalCompletion: vi.fn(),
    },
  },
}));

vi.mock('@/lib/toast', () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastAction: vi.fn(),
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { toastAction, toastError, toastSuccess } from '@/lib/toast';
import { renderHookWithClient } from '@/test/utils';
import {
  useBibleClasses,
  useBibleClassById,
  useCreateBibleClass,
  useUpdateBibleClass,
  useDeleteBibleClass,
  useEnrollResident,
  useUpdateEnrollment,
  useRemoveEnrollment,
  useEligibleResidents,
  useEnrollBulk,
  useMarkExternalCompletion,
  useUnmarkExternalCompletion,
  useResidentExternalCompletion,
} from './useBibleCourses';
import { useBibleClassGrades, useUpsertBibleGrade, useUpsertBibleGradesBulk } from './useBibleGrades';
import {
  useBibleModules,
  useCreateBibleModule,
  useUpdateBibleModule,
  useDeleteBibleModule,
} from './useBibleModules';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('turmas', () => {
  it('lista por status e desliga detalhe sem id', async () => {
    vi.mocked(api.bibleCourse.listClasses).mockResolvedValue([] as never);
    const { result } = renderHookWithClient(() => useBibleClasses('ACTIVE'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.bibleCourse.listClasses).toHaveBeenCalledWith('ACTIVE');

    const { result: d } = renderHookWithClient(() => useBibleClassById(null));
    expect(d.current.fetchStatus).toBe('idle');
  });

  it('create / update / delete', async () => {
    vi.mocked(api.bibleCourse.createClass).mockResolvedValue({ id: 'c1' } as never);
    vi.mocked(api.bibleCourse.updateClass).mockResolvedValue({ id: 'c1' } as never);
    vi.mocked(api.bibleCourse.deleteClass).mockResolvedValue(undefined as never);

    const { result: c, queryClient } = renderHookWithClient(() => useCreateBibleClass());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    c.current.mutate({ name: 'T' } as never);
    await waitFor(() => expect(c.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.bibleCourses.all });

    const { result: u } = renderHookWithClient(() => useUpdateBibleClass());
    u.current.mutate({ id: 'c1', data: { name: 'E' } } as never);
    await waitFor(() => expect(u.current.isSuccess).toBe(true));
    expect(api.bibleCourse.updateClass).toHaveBeenCalledWith('c1', { name: 'E' });

    const { result: del } = renderHookWithClient(() => useDeleteBibleClass());
    del.current.mutate('c1');
    await waitFor(() => expect(del.current.isSuccess).toBe(true));
    expect(api.bibleCourse.deleteClass).toHaveBeenCalledWith('c1');
  });

  it('matrícula: enroll / update / remove invalidam detalhe da turma', async () => {
    vi.mocked(api.bibleCourse.enroll).mockResolvedValue({} as never);
    vi.mocked(api.bibleCourse.updateEnrollment).mockResolvedValue({} as never);
    vi.mocked(api.bibleCourse.removeEnrollment).mockResolvedValue(undefined as never);

    const { result: e, queryClient } = renderHookWithClient(() => useEnrollResident('c1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    e.current.mutate({ residentId: 'r1' } as never);
    await waitFor(() => expect(e.current.isSuccess).toBe(true));
    expect(api.bibleCourse.enroll).toHaveBeenCalledWith('c1', { residentId: 'r1' });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.bibleCourses.detail('c1') });

    const { result: u } = renderHookWithClient(() => useUpdateEnrollment('c1'));
    u.current.mutate({ id: 'en1', data: { status: 'DONE' } } as never);
    await waitFor(() => expect(u.current.isSuccess).toBe(true));
    expect(api.bibleCourse.updateEnrollment).toHaveBeenCalledWith('en1', { status: 'DONE' });

    const { result: rm } = renderHookWithClient(() => useRemoveEnrollment('c1'));
    rm.current.mutate('en1');
    await waitFor(() => expect(rm.current.isSuccess).toBe(true));
    expect(api.bibleCourse.removeEnrollment).toHaveBeenCalledWith('en1');
  });

  it('elegíveis: busca lista e desliga quando enabled=false', async () => {
    vi.mocked(api.bibleCourse.listEligibleResidents).mockResolvedValue([] as never);

    const { result } = renderHookWithClient(() => useEligibleResidents());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.bibleCourse.listEligibleResidents).toHaveBeenCalledWith(undefined);

    const { result: off } = renderHookWithClient(() =>
      useEligibleResidents({ enabled: false }),
    );
    expect(off.current.fetchStatus).toBe('idle');
  });

  it('matrícula em lote invalida detalhe e lista da turma', async () => {
    vi.mocked(api.bibleCourse.enrollBulk).mockResolvedValue({ enrolled: 2 } as never);

    const { result, queryClient } = renderHookWithClient(() => useEnrollBulk('c1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate(['r1', 'r2']);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.bibleCourse.enrollBulk).toHaveBeenCalledWith('c1', ['r1', 'r2']);
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.bibleCourses.detail('c1') });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.bibleCourses.all });
  });
});

// Story 126: o toast é feedback de ação e mora no hook da mutation — todo
// consumidor (dialog, painel, página) ganha o mesmo feedback sem markup inline.
describe('toast das mutations (story 126)', () => {
  it('sucesso de cada mutation dispara toastSuccess com a mensagem da tabela', async () => {
    vi.mocked(api.bibleCourse.createClass).mockResolvedValue({ id: 'c1' } as never);
    vi.mocked(api.bibleCourse.updateClass).mockResolvedValue({ id: 'c1' } as never);
    vi.mocked(api.bibleCourse.deleteClass).mockResolvedValue(undefined as never);
    vi.mocked(api.bibleCourse.enrollBulk).mockResolvedValue({ enrolled: 3 } as never);
    vi.mocked(api.bibleCourse.enroll).mockResolvedValue({} as never);
    vi.mocked(api.bibleCourse.updateEnrollment).mockResolvedValue({} as never);
    vi.mocked(api.bibleCourse.removeEnrollment).mockResolvedValue(undefined as never);

    const { result: c } = renderHookWithClient(() => useCreateBibleClass());
    c.current.mutate({ name: 'T' } as never);
    await waitFor(() => expect(c.current.isSuccess).toBe(true));
    expect(toastSuccess).toHaveBeenCalledWith('Turma criada.');

    const { result: u } = renderHookWithClient(() => useUpdateBibleClass());
    u.current.mutate({ id: 'c1', data: { name: 'E' } } as never);
    await waitFor(() => expect(u.current.isSuccess).toBe(true));
    expect(toastSuccess).toHaveBeenCalledWith('Turma atualizada.');

    const { result: del } = renderHookWithClient(() => useDeleteBibleClass());
    del.current.mutate('c1');
    await waitFor(() => expect(del.current.isSuccess).toBe(true));
    expect(toastSuccess).toHaveBeenCalledWith('Turma excluída.');

    // Contagem vem da resposta do backend, não do tamanho da seleção.
    const { result: bulk } = renderHookWithClient(() => useEnrollBulk('c1'));
    bulk.current.mutate(['r1', 'r2', 'r3']);
    await waitFor(() => expect(bulk.current.isSuccess).toBe(true));
    expect(toastSuccess).toHaveBeenCalledWith('3 filho(s) matriculado(s).');

    const { result: e } = renderHookWithClient(() => useEnrollResident('c1'));
    e.current.mutate({ residentId: 'r1' } as never);
    await waitFor(() => expect(e.current.isSuccess).toBe(true));
    expect(toastSuccess).toHaveBeenCalledWith('Filho matriculado.');

    const { result: ue } = renderHookWithClient(() => useUpdateEnrollment('c1'));
    ue.current.mutate({ id: 'en1', data: { status: 'DONE' } } as never);
    await waitFor(() => expect(ue.current.isSuccess).toBe(true));
    expect(toastSuccess).toHaveBeenCalledWith('Matrícula atualizada.');

    const { result: rm } = renderHookWithClient(() => useRemoveEnrollment('c1'));
    rm.current.mutate('en1');
    await waitFor(() => expect(rm.current.isSuccess).toBe(true));
    expect(toastSuccess).toHaveBeenCalledWith('Matrícula removida.');

    expect(toastError).not.toHaveBeenCalled();
  });

  it('falha de cada mutation dispara toastError com o fallback da tabela', async () => {
    const boom = new Error('boom');
    vi.mocked(api.bibleCourse.createClass).mockRejectedValue(boom);
    vi.mocked(api.bibleCourse.updateClass).mockRejectedValue(boom);
    vi.mocked(api.bibleCourse.deleteClass).mockRejectedValue(boom);
    vi.mocked(api.bibleCourse.enrollBulk).mockRejectedValue(boom);
    vi.mocked(api.bibleCourse.enroll).mockRejectedValue(boom);
    vi.mocked(api.bibleCourse.updateEnrollment).mockRejectedValue(boom);
    vi.mocked(api.bibleCourse.removeEnrollment).mockRejectedValue(boom);

    const { result: c } = renderHookWithClient(() => useCreateBibleClass());
    c.current.mutate({ name: 'T' } as never);
    await waitFor(() => expect(c.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledWith(boom, 'Erro ao salvar turma.');

    const { result: u } = renderHookWithClient(() => useUpdateBibleClass());
    u.current.mutate({ id: 'c1', data: { name: 'E' } } as never);
    await waitFor(() => expect(u.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledWith(boom, 'Erro ao salvar turma.');

    const { result: del } = renderHookWithClient(() => useDeleteBibleClass());
    del.current.mutate('c1');
    await waitFor(() => expect(del.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledWith(boom, 'Erro ao excluir turma.');

    const { result: bulk } = renderHookWithClient(() => useEnrollBulk('c1'));
    bulk.current.mutate(['r1']);
    await waitFor(() => expect(bulk.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledWith(boom, 'Erro ao matricular.');

    const { result: e } = renderHookWithClient(() => useEnrollResident('c1'));
    e.current.mutate({ residentId: 'r1' } as never);
    await waitFor(() => expect(e.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledWith(boom, 'Erro ao matricular.');

    const { result: ue } = renderHookWithClient(() => useUpdateEnrollment('c1'));
    ue.current.mutate({ id: 'en1', data: { status: 'DONE' } } as never);
    await waitFor(() => expect(ue.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledWith(boom, 'Erro ao atualizar matrícula.');

    const { result: rm } = renderHookWithClient(() => useRemoveEnrollment('c1'));
    rm.current.mutate('en1');
    await waitFor(() => expect(rm.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledWith(boom, 'Erro ao remover matrícula.');

    expect(toastSuccess).not.toHaveBeenCalled();
  });
});

// Story 127: marcar/desmarcar mexe em duas telas — o painel de sugeridos (o
// filho some/volta) e a ficha do filho (o campo aparece/some). Por isso as duas
// queries são invalidadas nos dois sentidos.
describe('curso feito fora do sistema (story 127)', () => {
  it('busca a marcação da ficha e fica ociosa quando desabilitada', async () => {
    vi.mocked(api.bibleCourse.getExternalCompletion).mockResolvedValue(null as never);

    const { result } = renderHookWithClient(() => useResidentExternalCompletion('r1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.bibleCourse.getExternalCompletion).toHaveBeenCalledWith('r1');

    // Sem permissão a query não roda — o endpoint é ADMIN/COORDINATOR.
    const { result: off } = renderHookWithClient(() =>
      useResidentExternalCompletion('r1', { enabled: false }),
    );
    expect(off.current.fetchStatus).toBe('idle');
  });

  it('marcar invalida elegíveis e ficha', async () => {
    vi.mocked(api.bibleCourse.markExternalCompletion).mockResolvedValue({} as never);

    const { result, queryClient } = renderHookWithClient(() => useMarkExternalCompletion());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate({ residentId: 'r1', residentName: 'Filho A' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.bibleCourse.markExternalCompletion).toHaveBeenCalledWith('r1');
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.bibleCourses.eligibleResidentsAll });
    expect(spy).toHaveBeenCalledWith({
      queryKey: queryKeys.bibleCourses.externalCompletion('r1'),
    });
  });

  it('desmarcar invalida elegíveis e ficha', async () => {
    vi.mocked(api.bibleCourse.unmarkExternalCompletion).mockResolvedValue(undefined as never);

    const { result, queryClient } = renderHookWithClient(() => useUnmarkExternalCompletion());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate({ residentId: 'r1', residentName: 'Filho A' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.bibleCourse.unmarkExternalCompletion).toHaveBeenCalledWith('r1');
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.bibleCourses.eligibleResidentsAll });
    expect(spy).toHaveBeenCalledWith({
      queryKey: queryKeys.bibleCourses.externalCompletion('r1'),
    });
    expect(toastSuccess).toHaveBeenCalledWith('Marcação removida.');
  });

  // Decisão 5: engano na hora se conserta pelo próprio toast.
  it('o toast de marcar traz "Desfazer" que desmarca de verdade', async () => {
    vi.mocked(api.bibleCourse.markExternalCompletion).mockResolvedValue({} as never);
    vi.mocked(api.bibleCourse.unmarkExternalCompletion).mockResolvedValue(undefined as never);

    const { result } = renderHookWithClient(() => useMarkExternalCompletion());
    result.current.mutate({ residentId: 'r1', residentName: 'Filho A' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(toastAction).toHaveBeenCalledWith(
      'Filho A marcado como já fez o curso.',
      expect.objectContaining({ label: 'Desfazer' }),
    );
    // Toast de ação, não de sucesso: o "Desfazer" precisa caber na mensagem.
    expect(toastSuccess).not.toHaveBeenCalled();

    vi.mocked(toastAction).mock.calls[0][1].onClick();
    await waitFor(() =>
      expect(api.bibleCourse.unmarkExternalCompletion).toHaveBeenCalledWith('r1'),
    );
  });

  it('falha de marcar/desmarcar dispara toastError com o fallback da tabela', async () => {
    const boom = new Error('boom');
    vi.mocked(api.bibleCourse.markExternalCompletion).mockRejectedValue(boom);
    vi.mocked(api.bibleCourse.unmarkExternalCompletion).mockRejectedValue(boom);

    const { result: m } = renderHookWithClient(() => useMarkExternalCompletion());
    m.current.mutate({ residentId: 'r1', residentName: 'Filho A' });
    await waitFor(() => expect(m.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledWith(boom, 'Erro ao marcar o curso como já feito.');

    const { result: u } = renderHookWithClient(() => useUnmarkExternalCompletion());
    u.current.mutate({ residentId: 'r1', residentName: 'Filho A' });
    await waitFor(() => expect(u.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledWith(boom, 'Erro ao remover marcação.');

    expect(toastAction).not.toHaveBeenCalled();
  });
});

describe('notas', () => {
  it('grades desliga sem classId', () => {
    const { result } = renderHookWithClient(() => useBibleClassGrades(null));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('upsert nota única invalida grades', async () => {
    vi.mocked(api.bibleCourse.upsertGrade).mockResolvedValue({} as never);
    const { result, queryClient } = renderHookWithClient(() => useUpsertBibleGrade('c1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate({ enrollmentId: 'en1', moduleId: 'm1', data: { value: 8 } } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.bibleCourse.upsertGrade).toHaveBeenCalledWith('en1', 'm1', { value: 8 });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.bibleCourses.grades('c1') });
  });

  it('upsert em lote chama upsertGrade por aluno alterado', async () => {
    vi.mocked(api.bibleCourse.upsertGrade).mockResolvedValue({} as never);
    const { result } = renderHookWithClient(() => useUpsertBibleGradesBulk('c1'));
    result.current.mutate({
      moduleId: 'm1',
      changes: [
        { enrollmentId: 'en1', data: { value: 8 } as never },
        { enrollmentId: 'en2', data: { value: 9 } as never },
      ],
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.bibleCourse.upsertGrade).toHaveBeenCalledTimes(2);
  });
});

describe('módulos', () => {
  it('lista, cria, atualiza e remove invalidando modules', async () => {
    vi.mocked(api.bibleCourse.listModules).mockResolvedValue([] as never);
    vi.mocked(api.bibleCourse.createModule).mockResolvedValue({} as never);
    vi.mocked(api.bibleCourse.updateModule).mockResolvedValue({} as never);
    vi.mocked(api.bibleCourse.deleteModule).mockResolvedValue(undefined as never);

    const { result } = renderHookWithClient(() => useBibleModules());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const { result: c, queryClient } = renderHookWithClient(() => useCreateBibleModule());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    c.current.mutate({ name: 'M' } as never);
    await waitFor(() => expect(c.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.bibleCourses.modules });

    const { result: u } = renderHookWithClient(() => useUpdateBibleModule());
    u.current.mutate({ id: 'm1', data: { name: 'E' } } as never);
    await waitFor(() => expect(u.current.isSuccess).toBe(true));
    expect(api.bibleCourse.updateModule).toHaveBeenCalledWith('m1', { name: 'E' });

    const { result: d } = renderHookWithClient(() => useDeleteBibleModule());
    d.current.mutate('m1');
    await waitFor(() => expect(d.current.isSuccess).toBe(true));
    expect(api.bibleCourse.deleteModule).toHaveBeenCalledWith('m1');
  });
});

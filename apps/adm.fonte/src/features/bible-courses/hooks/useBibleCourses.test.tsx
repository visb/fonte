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
      updateEnrollment: vi.fn(),
      removeEnrollment: vi.fn(),
      getClassGrades: vi.fn(),
      upsertGrade: vi.fn(),
      listModules: vi.fn(),
      createModule: vi.fn(),
      updateModule: vi.fn(),
      deleteModule: vi.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
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

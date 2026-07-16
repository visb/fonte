import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    bibleCourse: {
      listClassPhotos: vi.fn(),
      uploadClassPhoto: vi.fn(),
      deleteClassPhoto: vi.fn(),
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
import { toastError } from '@/lib/toast';
import { renderHookWithClient } from '@/test/utils';
import {
  useBibleCourseClassPhotos,
  useUploadBibleCourseClassPhoto,
  useDeleteBibleCourseClassPhoto,
} from './useBibleCoursePhotos';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('useBibleCourseClassPhotos', () => {
  it('lista as fotos quando há classId (enabled)', async () => {
    vi.mocked(api.bibleCourse.listClassPhotos).mockResolvedValue([] as never);
    const { result } = renderHookWithClient(() => useBibleCourseClassPhotos('c1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.bibleCourse.listClassPhotos).toHaveBeenCalledWith('c1');
  });

  it('não dispara a query sem classId (enabled=false)', () => {
    const { result } = renderHookWithClient(() => useBibleCourseClassPhotos(null));
    expect(result.current.fetchStatus).toBe('idle');
    expect(api.bibleCourse.listClassPhotos).not.toHaveBeenCalled();
  });

  it('upload monta FormData com o arquivo e invalida a key de fotos', async () => {
    vi.mocked(api.bibleCourse.uploadClassPhoto).mockResolvedValue({ id: 'p1' } as never);
    const { result, queryClient } = renderHookWithClient(() =>
      useUploadBibleCourseClassPhoto('c1'),
    );
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    result.current.mutate(file);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [calledClassId, formData] = vi.mocked(api.bibleCourse.uploadClassPhoto).mock.calls[0];
    expect(calledClassId).toBe('c1');
    expect(formData).toBeInstanceOf(FormData);
    expect((formData as FormData).get('file')).toBe(file);
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.bibleCourses.photos('c1') });
  });

  it('delete remove a foto e invalida a key de fotos', async () => {
    vi.mocked(api.bibleCourse.deleteClassPhoto).mockResolvedValue(undefined as never);
    const { result, queryClient } = renderHookWithClient(() =>
      useDeleteBibleCourseClassPhoto('c1'),
    );
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate('p1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.bibleCourse.deleteClassPhoto).toHaveBeenCalledWith('c1', 'p1');
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.bibleCourses.photos('c1') });
  });

  // Story 126: erro de mutation vira toast no hook (sucesso não tem toast — a
  // miniatura aparecendo/sumindo já é o feedback).
  it('falha no upload dispara toastError com o fallback da foto', async () => {
    const boom = new Error('boom');
    vi.mocked(api.bibleCourse.uploadClassPhoto).mockRejectedValue(boom);
    const { result } = renderHookWithClient(() => useUploadBibleCourseClassPhoto('c1'));
    result.current.mutate(new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledWith(boom, 'Erro ao enviar a foto.');
  });

  it('falha ao remover dispara toastError com o fallback da remoção', async () => {
    const boom = new Error('boom');
    vi.mocked(api.bibleCourse.deleteClassPhoto).mockRejectedValue(boom);
    const { result } = renderHookWithClient(() => useDeleteBibleCourseClassPhoto('c1'));
    result.current.mutate('p1');
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalledWith(boom, 'Erro ao remover a foto.');
  });
});

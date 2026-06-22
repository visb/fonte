import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    activities: {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      changeStatus: vi.fn(),
      remove: vi.fn(),
      listComments: vi.fn(),
      addComment: vi.fn(),
      deleteComment: vi.fn(),
      listEvents: vi.fn(),
      uploadAttachment: vi.fn(),
      uploadCommentAttachment: vi.fn(),
      deleteAttachment: vi.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithClient } from '@/test/utils';
import {
  useActivities,
  useActivity,
  useCreateActivity,
  useUpdateActivity,
  useChangeActivityStatus,
  useDeleteActivity,
  useActivityComments,
  useAddComment,
  useDeleteComment,
  useActivityEvents,
  useUploadActivityAttachment,
  useUploadCommentAttachment,
  useDeleteAttachment,
} from './useActivities';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('queries', () => {
  it('useActivities lista com a queryKey de filtros', async () => {
    vi.mocked(api.activities.list).mockResolvedValue([{ id: 'a1' }] as never);
    const filters = { houseId: 'h1' };
    const { result, queryClient } = renderHookWithClient(() => useActivities(filters));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.activities.list).toHaveBeenCalledWith(filters);
    expect(queryClient.getQueryData(queryKeys.activities.list(filters))).toEqual([{ id: 'a1' }]);
  });

  it('useActivity desliga com id vazio e liga com id', async () => {
    const { result } = renderHookWithClient(() => useActivity(''));
    expect(result.current.fetchStatus).toBe('idle');

    vi.mocked(api.activities.getById).mockResolvedValue({ id: 'a1' } as never);
    const { result: r2 } = renderHookWithClient(() => useActivity('a1'));
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));
    expect(api.activities.getById).toHaveBeenCalledWith('a1');
  });

  it('comments e events respeitam enabled e id', async () => {
    const { result } = renderHookWithClient(() => useActivityComments('', { enabled: true }));
    expect(result.current.fetchStatus).toBe('idle');

    vi.mocked(api.activities.listComments).mockResolvedValue([] as never);
    const { result: r2 } = renderHookWithClient(() => useActivityComments('a1'));
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));
    expect(api.activities.listComments).toHaveBeenCalledWith('a1');

    vi.mocked(api.activities.listEvents).mockResolvedValue([] as never);
    const { result: r3 } = renderHookWithClient(() => useActivityEvents('a1'));
    await waitFor(() => expect(r3.current.isSuccess).toBe(true));
    expect(api.activities.listEvents).toHaveBeenCalledWith('a1');
  });
});

describe('mutations de atividade', () => {
  it('create invalida tudo', async () => {
    vi.mocked(api.activities.create).mockResolvedValue({ id: 'a1' } as never);
    const { result, queryClient } = renderHookWithClient(() => useCreateActivity());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate({ title: 'T' } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.activities.create).toHaveBeenCalledWith({ title: 'T' });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.activities.all });
  });

  it('update invalida tudo + detalhe', async () => {
    vi.mocked(api.activities.update).mockResolvedValue({ id: 'a1' } as never);
    const { result, queryClient } = renderHookWithClient(() => useUpdateActivity());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate({ id: 'a1', data: { title: 'X' } } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.activities.update).toHaveBeenCalledWith('a1', { title: 'X' });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.activities.detail('a1') });
  });

  it('changeStatus invalida tudo + detalhe', async () => {
    vi.mocked(api.activities.changeStatus).mockResolvedValue({ id: 'a1' } as never);
    const { result } = renderHookWithClient(() => useChangeActivityStatus());
    result.current.mutate({ id: 'a1', data: { status: 'DOING' } } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.activities.changeStatus).toHaveBeenCalledWith('a1', { status: 'DOING' });
  });

  it('delete invalida tudo', async () => {
    vi.mocked(api.activities.remove).mockResolvedValue(undefined as never);
    const { result } = renderHookWithClient(() => useDeleteActivity());
    result.current.mutate('a1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.activities.remove).toHaveBeenCalledWith('a1');
  });
});

describe('comentários e anexos', () => {
  it('addComment invalida comments e events', async () => {
    vi.mocked(api.activities.addComment).mockResolvedValue({ id: 'c1' } as never);
    const { result, queryClient } = renderHookWithClient(() => useAddComment('a1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate({ body: 'oi' } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.activities.comments('a1') });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.activities.events('a1') });
  });

  it('deleteComment invalida comments', async () => {
    vi.mocked(api.activities.deleteComment).mockResolvedValue(undefined as never);
    const { result } = renderHookWithClient(() => useDeleteComment('a1'));
    result.current.mutate('c1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.activities.deleteComment).toHaveBeenCalledWith('a1', 'c1');
  });

  it('upload de anexo na atividade envia FormData com durationSeconds e invalida detalhe', async () => {
    vi.mocked(api.activities.uploadAttachment).mockResolvedValue({ id: 'at1' } as never);
    const { result, queryClient } = renderHookWithClient(() => useUploadActivityAttachment('a1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const file = new File(['x'], 'a.mp3');
    result.current.mutate({ file, durationSeconds: 30.6 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const fd = vi.mocked(api.activities.uploadAttachment).mock.calls[0][1] as FormData;
    expect(fd.get('file')).toBeInstanceOf(File);
    expect(fd.get('durationSeconds')).toBe('31');
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.activities.detail('a1') });
  });

  it('upload de anexo sem duração não inclui o campo', async () => {
    vi.mocked(api.activities.uploadCommentAttachment).mockResolvedValue({ id: 'at1' } as never);
    const { result } = renderHookWithClient(() => useUploadCommentAttachment('a1'));
    const file = new File(['x'], 'a.pdf');
    result.current.mutate({ commentId: 'c1', file });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const fd = vi.mocked(api.activities.uploadCommentAttachment).mock.calls[0][2] as FormData;
    expect(fd.get('durationSeconds')).toBeNull();
  });

  it('deleteAttachment invalida detalhe e comments', async () => {
    vi.mocked(api.activities.deleteAttachment).mockResolvedValue(undefined as never);
    const { result, queryClient } = renderHookWithClient(() => useDeleteAttachment('a1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate('at1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.activities.deleteAttachment).toHaveBeenCalledWith('a1', 'at1');
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.activities.detail('a1') });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.activities.comments('a1') });
  });
});

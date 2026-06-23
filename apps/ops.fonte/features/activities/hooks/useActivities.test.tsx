import { waitFor } from '@testing-library/react-native';

// api-client mockado: nenhuma chamada HTTP real.
jest.mock('@/lib/api', () => ({
  api: {
    activities: {
      list: jest.fn(),
      getById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      changeStatus: jest.fn(),
      listComments: jest.fn(),
      addComment: jest.fn(),
      deleteComment: jest.fn(),
      uploadAttachment: jest.fn(),
      uploadCommentAttachment: jest.fn(),
      deleteAttachment: jest.fn(),
    },
  },
}));

import { Platform } from 'react-native';
import { api } from '@/lib/api';
import { renderHookWithClient } from '@/lib/test/utils';
import {
  useActivities,
  useActivity,
  useCreateActivity,
  useUpdateActivity,
  useChangeActivityStatus,
  useActivityComments,
  useAddComment,
  useDeleteComment,
  useUploadActivityAttachment,
  useUploadCommentAttachment,
  useDeleteAttachment,
} from './useActivities';

const mockApi = api as unknown as {
  activities: Record<string, jest.Mock>;
};

beforeEach(() => jest.clearAllMocks());

describe('useActivities (queries)', () => {
  it('lista atividades quando há houseId (enabled)', async () => {
    const data = [{ id: 'a1' }];
    mockApi.activities.list.mockResolvedValue(data);
    const { result } = renderHookWithClient(() => useActivities('house-1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.activities.list).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(data);
  });

  it('não dispara a query sem houseId (enabled=false)', () => {
    renderHookWithClient(() => useActivities(null));
    expect(mockApi.activities.list).not.toHaveBeenCalled();
  });

  it('useActivity busca o detalhe por id', async () => {
    mockApi.activities.getById.mockResolvedValue({ id: 'a1' });
    const { result } = renderHookWithClient(() => useActivity('a1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.activities.getById).toHaveBeenCalledWith('a1');
  });

  it('useActivity não dispara sem id', () => {
    renderHookWithClient(() => useActivity(undefined));
    expect(mockApi.activities.getById).not.toHaveBeenCalled();
  });

  it('useActivityComments lista comentários por atividade', async () => {
    mockApi.activities.listComments.mockResolvedValue([{ id: 'c1' }]);
    const { result } = renderHookWithClient(() => useActivityComments('a1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.activities.listComments).toHaveBeenCalledWith('a1');
  });

  it('useActivityComments não dispara sem id', () => {
    renderHookWithClient(() => useActivityComments(null));
    expect(mockApi.activities.listComments).not.toHaveBeenCalled();
  });
});

describe('useActivities (mutations)', () => {
  it('useCreateActivity repassa o payload', async () => {
    mockApi.activities.create.mockResolvedValue({ id: 'new' });
    const { result } = renderHookWithClient(() => useCreateActivity());
    result.current.mutate({ title: 'X', houseId: 'h1' } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.activities.create).toHaveBeenCalledWith({ title: 'X', houseId: 'h1' });
  });

  it('useUpdateActivity chama update com id e data', async () => {
    mockApi.activities.update.mockResolvedValue({ id: 'a1' });
    const { result } = renderHookWithClient(() => useUpdateActivity());
    result.current.mutate({ id: 'a1', data: { title: 'novo' } as never });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.activities.update).toHaveBeenCalledWith('a1', { title: 'novo' });
  });

  it('useChangeActivityStatus chama changeStatus', async () => {
    mockApi.activities.changeStatus.mockResolvedValue({ id: 'a1' });
    const { result } = renderHookWithClient(() => useChangeActivityStatus());
    result.current.mutate({ id: 'a1', data: { status: 'DONE' } as never });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.activities.changeStatus).toHaveBeenCalledWith('a1', { status: 'DONE' });
  });

  it('useAddComment chama addComment com o id da atividade', async () => {
    mockApi.activities.addComment.mockResolvedValue({ id: 'c1' });
    const { result } = renderHookWithClient(() => useAddComment('a1'));
    result.current.mutate({ body: 'oi' } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.activities.addComment).toHaveBeenCalledWith('a1', { body: 'oi' });
  });

  it('useDeleteComment chama deleteComment com os dois ids', async () => {
    mockApi.activities.deleteComment.mockResolvedValue(undefined);
    const { result } = renderHookWithClient(() => useDeleteComment('a1'));
    result.current.mutate('c1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.activities.deleteComment).toHaveBeenCalledWith('a1', 'c1');
  });

  it('useDeleteAttachment chama deleteAttachment', async () => {
    mockApi.activities.deleteAttachment.mockResolvedValue(undefined);
    const { result } = renderHookWithClient(() => useDeleteAttachment('a1'));
    result.current.mutate('att-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.activities.deleteAttachment).toHaveBeenCalledWith('a1', 'att-1');
  });
});

describe('upload de anexos (FormData multipart, web)', () => {
  const originalOS = Platform.OS;
  beforeAll(() => {
    // @ts-expect-error override controlado para o ramo web.
    Platform.OS = 'web';
    // fetch().blob() usado no ramo web do toAttachmentFormData.
    global.fetch = jest.fn().mockResolvedValue({
      blob: () => Promise.resolve(new Blob(['x'], { type: 'image/png' })),
    }) as never;
  });
  afterAll(() => {
    // @ts-expect-error restaura.
    Platform.OS = originalOS;
  });

  it('useUploadActivityAttachment monta FormData com nome derivado da extensão', async () => {
    mockApi.activities.uploadAttachment.mockResolvedValue({ id: 'att' });
    const { result } = renderHookWithClient(() => useUploadActivityAttachment('a1'));
    result.current.mutate({ uri: 'blob:x', mimeType: 'image/png', name: 'foto' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [id, fd] = mockApi.activities.uploadAttachment.mock.calls[0];
    expect(id).toBe('a1');
    expect(fd).toBeInstanceOf(FormData);
    const file = (fd as FormData).get('file') as File;
    expect(file.name).toBe('foto.png');
  });

  it('useUploadActivityAttachment anexa durationSeconds arredondado para áudio', async () => {
    mockApi.activities.uploadAttachment.mockResolvedValue({ id: 'att' });
    const { result } = renderHookWithClient(() => useUploadActivityAttachment('a1'));
    result.current.mutate({
      uri: 'blob:a',
      mimeType: 'audio/webm',
      name: 'audio.webm',
      durationSeconds: 12.7,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const fd = mockApi.activities.uploadAttachment.mock.calls[0][1] as FormData;
    expect(fd.get('durationSeconds')).toBe('13');
  });

  it('useUploadCommentAttachment passa atividade, comentário e FormData', async () => {
    mockApi.activities.uploadCommentAttachment.mockResolvedValue({ id: 'att' });
    const { result } = renderHookWithClient(() => useUploadCommentAttachment('a1'));
    result.current.mutate({
      commentId: 'c1',
      att: { uri: 'blob:b', mimeType: 'image/png', name: 'img.png' },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [actId, cId, fd] = mockApi.activities.uploadCommentAttachment.mock.calls[0];
    expect(actId).toBe('a1');
    expect(cId).toBe('c1');
    expect(fd).toBeInstanceOf(FormData);
  });
});

describe('upload de anexos (nativo)', () => {
  const originalOS = Platform.OS;
  beforeAll(() => {
    // @ts-expect-error override para o ramo nativo (sem fetch().blob()).
    Platform.OS = 'ios';
  });
  afterAll(() => {
    // @ts-expect-error restaura.
    Platform.OS = originalOS;
  });

  it('no nativo anexa { uri, type, name } direto, sem buscar blob', async () => {
    mockApi.activities.uploadAttachment.mockResolvedValue({ id: 'att' });
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as never;
    const { result } = renderHookWithClient(() => useUploadActivityAttachment('a1'));
    result.current.mutate({ uri: 'file:///doc.pdf', mimeType: 'application/pdf', name: 'doc.pdf' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSpy).not.toHaveBeenCalled();
    const fd = mockApi.activities.uploadAttachment.mock.calls[0][1] as FormData;
    expect(fd).toBeInstanceOf(FormData);
  });
});

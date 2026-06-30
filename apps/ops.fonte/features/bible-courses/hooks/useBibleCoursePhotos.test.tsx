import { waitFor } from '@testing-library/react-native';

jest.mock('@/lib/api', () => ({
  api: {
    bibleCourse: {
      listClassPhotos: jest.fn(),
      uploadClassPhoto: jest.fn(),
      deleteClassPhoto: jest.fn(),
    },
  },
}));

import { Platform } from 'react-native';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { createTestQueryClient, renderHookWithClient } from '@/lib/test/utils';
import {
  useBibleCourseClassPhotos,
  useUploadBibleCourseClassPhoto,
  useDeleteBibleCourseClassPhoto,
  toClassPhotoFormData,
} from './useBibleCoursePhotos';

const mockApi = api as unknown as { bibleCourse: Record<string, jest.Mock> };

beforeEach(() => jest.clearAllMocks());

describe('useBibleCourseClassPhotos', () => {
  it('lista as fotos quando há classId (enabled)', async () => {
    mockApi.bibleCourse.listClassPhotos.mockResolvedValue([{ id: 'p1' }]);
    const { result } = renderHookWithClient(() => useBibleCourseClassPhotos('c1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.bibleCourse.listClassPhotos).toHaveBeenCalledWith('c1');
  });

  it('não dispara a query sem classId (enabled=false)', () => {
    const { result } = renderHookWithClient(() => useBibleCourseClassPhotos(null));
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApi.bibleCourse.listClassPhotos).not.toHaveBeenCalled();
  });
});

describe('useUploadBibleCourseClassPhoto', () => {
  it('sobe a foto e invalida a key de fotos', async () => {
    mockApi.bibleCourse.uploadClassPhoto.mockResolvedValue({ id: 'p1' });
    const client = createTestQueryClient();
    const spy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHookWithClient(
      () => useUploadBibleCourseClassPhoto('c1'),
      client,
    );
    result.current.mutate({ uri: 'file://x.jpg', mimeType: 'image/jpeg', name: 'x.jpg' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.bibleCourse.uploadClassPhoto).toHaveBeenCalledWith('c1', expect.any(FormData));
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.bibleCourses.photos('c1') });
  });
});

describe('useDeleteBibleCourseClassPhoto', () => {
  it('remove a foto e invalida a key de fotos', async () => {
    mockApi.bibleCourse.deleteClassPhoto.mockResolvedValue(undefined);
    const client = createTestQueryClient();
    const spy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHookWithClient(
      () => useDeleteBibleCourseClassPhoto('c1'),
      client,
    );
    result.current.mutate('p1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.bibleCourse.deleteClassPhoto).toHaveBeenCalledWith('c1', 'p1');
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.bibleCourses.photos('c1') });
  });
});

describe('toClassPhotoFormData', () => {
  const photo = { uri: 'file://foto.jpg', mimeType: 'image/jpeg', name: 'foto.jpg' };

  it('no nativo anexa o arquivo sem buscar blob', async () => {
    Platform.OS = 'ios';
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as never;
    const fd = await toClassPhotoFormData(photo);
    expect(fd.has('file')).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('no web busca o blob e completa a extensão a partir do mimetype', async () => {
    Platform.OS = 'web';
    const blob = new Blob(['x'], { type: 'image/png' });
    global.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) }) as never;
    const fd = await toClassPhotoFormData({ uri: 'blob:abc', mimeType: 'image/png', name: 'sem-ext' });
    const file = fd.get('file') as File;
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('sem-ext.png');
    Platform.OS = 'ios';
  });

  it('no web preserva o nome com extensão e cai no mimeType do picker quando o blob não tem type', async () => {
    Platform.OS = 'web';
    const blob = new Blob(['x'], { type: '' });
    global.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) }) as never;
    const fd = await toClassPhotoFormData({ uri: 'blob:abc', mimeType: 'image/jpeg', name: 'foto.jpg' });
    const file = fd.get('file') as File;
    expect(file.name).toBe('foto.jpg');
    expect(file.type).toBe('image/jpeg');
    Platform.OS = 'ios';
  });
});

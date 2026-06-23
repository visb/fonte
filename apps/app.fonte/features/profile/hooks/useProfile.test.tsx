import { waitFor } from '@testing-library/react-native';

jest.mock('@/lib/api', () => ({
  api: { relatives: { updateMe: jest.fn(), uploadPhotoMe: jest.fn() } },
}));

import { api } from '@/lib/api';
import { renderHookWithClient } from '@/lib/test/utils';
import { useUpdateProfile, useUploadProfilePhoto } from './useProfile';

const mockApi = api as unknown as {
  relatives: { updateMe: jest.Mock; uploadPhotoMe: jest.Mock };
};

describe('useUpdateProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('atualiza o perfil e grava no cache (setQueryData)', async () => {
    const updated = { id: 'rel-1', name: 'Ana Maria', phone: '11999990000' };
    mockApi.relatives.updateMe.mockResolvedValue(updated);

    const { result } = renderHookWithClient(() => useUpdateProfile());
    result.current.mutate({ name: 'Ana Maria', phone: '11999990000' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.relatives.updateMe).toHaveBeenCalledWith({
      name: 'Ana Maria',
      phone: '11999990000',
    });
    expect(result.current.data).toEqual(updated);
  });
});

describe('useUploadProfilePhoto', () => {
  beforeEach(() => jest.clearAllMocks());

  it('envia a foto (FormData nativo) e atualiza o cache', async () => {
    const updated = { id: 'rel-1', name: 'Ana', photoUrl: 'photos/a.jpg' };
    mockApi.relatives.uploadPhotoMe.mockResolvedValue(updated);

    const { result } = renderHookWithClient(() => useUploadProfilePhoto());
    result.current.mutate({ uri: 'file://a.jpg', type: 'image/jpeg' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.relatives.uploadPhotoMe).toHaveBeenCalledTimes(1);
    const fd = mockApi.relatives.uploadPhotoMe.mock.calls[0][0];
    expect(fd).toBeInstanceOf(FormData);
    expect(result.current.data).toEqual(updated);
  });
});

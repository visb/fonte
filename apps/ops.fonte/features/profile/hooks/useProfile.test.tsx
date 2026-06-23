import { waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

jest.mock('@/lib/api', () => ({
  api: {
    staff: { updateMe: jest.fn(), uploadPhotoMe: jest.fn() },
    residents: { uploadPhotoMe: jest.fn() },
  },
}));

import { api } from '@/lib/api';
import { renderHookWithClient } from '@/lib/test/utils';
import {
  useUpdateStaffProfile,
  useUploadStaffPhoto,
  useUploadResidentPhoto,
} from './useProfile';

const m = api as unknown as { staff: Record<string, jest.Mock>; residents: Record<string, jest.Mock> };

beforeEach(() => jest.clearAllMocks());

describe('useProfile', () => {
  it('useUpdateStaffProfile atualiza o próprio perfil', async () => {
    m.staff.updateMe.mockResolvedValue({ id: 's1' });
    const { result } = renderHookWithClient(() => useUpdateStaffProfile());
    result.current.mutate({ name: 'Servo X' } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.staff.updateMe).toHaveBeenCalledWith({ name: 'Servo X' });
  });

  describe('upload de foto (web)', () => {
    const origOS = Platform.OS;
    beforeAll(() => {
      // @ts-expect-error força ramo web
      Platform.OS = 'web';
      global.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(new Blob(['x'])) }) as never;
    });
    afterAll(() => {
      // @ts-expect-error restaura
      Platform.OS = origOS;
    });

    it('useUploadStaffPhoto envia FormData para staff/me', async () => {
      m.staff.uploadPhotoMe.mockResolvedValue({});
      const { result } = renderHookWithClient(() => useUploadStaffPhoto());
      result.current.mutate({ uri: 'blob:x', type: 'image/jpeg' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(m.staff.uploadPhotoMe).toHaveBeenCalledWith(expect.any(FormData));
    });

    it('useUploadResidentPhoto envia FormData para residents/me', async () => {
      m.residents.uploadPhotoMe.mockResolvedValue({});
      const { result } = renderHookWithClient(() => useUploadResidentPhoto());
      result.current.mutate({ uri: 'blob:x', type: 'image/jpeg' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(m.residents.uploadPhotoMe).toHaveBeenCalledWith(expect.any(FormData));
    });
  });
});

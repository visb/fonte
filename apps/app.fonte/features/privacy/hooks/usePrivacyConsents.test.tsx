import { waitFor } from '@testing-library/react-native';

jest.mock('@/lib/api', () => ({
  api: {
    consents: {
      myStatus: jest.fn(),
      myGrant: jest.fn(),
      myRevoke: jest.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { renderHookWithClient } from '@/lib/test/utils';
import { useMyConsents, useToggleConsent } from './usePrivacyConsents';

const mockApi = api as unknown as {
  consents: { myStatus: jest.Mock; myGrant: jest.Mock; myRevoke: jest.Mock };
};

describe('useMyConsents', () => {
  beforeEach(() => jest.clearAllMocks());

  it('busca o status de consentimentos do familiar', async () => {
    const status = [{ purpose: 'IMAGE_USE', granted: false }];
    mockApi.consents.myStatus.mockResolvedValue(status);

    const { result } = renderHookWithClient(() => useMyConsents());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(status);
  });
});

describe('useToggleConsent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('concede o consentimento quando ainda não foi dado (granted=false → grant)', async () => {
    mockApi.consents.myGrant.mockResolvedValue({ purpose: 'IMAGE_USE', granted: true });

    const { result } = renderHookWithClient(() => useToggleConsent());
    result.current.mutate({ purpose: 'IMAGE_USE' as never, granted: false });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.consents.myGrant).toHaveBeenCalledWith('IMAGE_USE');
    expect(mockApi.consents.myRevoke).not.toHaveBeenCalled();
  });

  it('revoga o consentimento quando já estava concedido (granted=true → revoke)', async () => {
    mockApi.consents.myRevoke.mockResolvedValue({ purpose: 'IMAGE_USE', granted: false });

    const { result } = renderHookWithClient(() => useToggleConsent());
    result.current.mutate({ purpose: 'IMAGE_USE' as never, granted: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.consents.myRevoke).toHaveBeenCalledWith('IMAGE_USE');
    expect(mockApi.consents.myGrant).not.toHaveBeenCalled();
  });
});

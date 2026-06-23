import { waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

jest.mock('@/lib/api', () => ({
  api: {
    houses: {
      getById: jest.fn(),
      update: jest.fn(),
      createCapacityRequest: jest.fn(),
      addPhoto: jest.fn(),
      deletePhoto: jest.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { renderHookWithClient } from '@/lib/test/utils';
import {
  useHouseById,
  useUpdateHouse,
  useRequestCapacityChange,
  useAddHousePhoto,
  useRemoveHousePhoto,
} from './useHouseSettings';

const m = api as unknown as { houses: Record<string, jest.Mock> };

beforeEach(() => jest.clearAllMocks());

describe('useHouseSettings', () => {
  it('useHouseById busca quando id presente', async () => {
    m.houses.getById.mockResolvedValue({ id: 'h1' });
    const { result } = renderHookWithClient(() => useHouseById('h1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.houses.getById).toHaveBeenCalledWith('h1');
  });

  it('useHouseById respeita enabled=false', () => {
    renderHookWithClient(() => useHouseById('h1', { enabled: false }));
    expect(m.houses.getById).not.toHaveBeenCalled();
  });

  it('useUpdateHouse atualiza', async () => {
    m.houses.update.mockResolvedValue({ id: 'h1' });
    const { result } = renderHookWithClient(() => useUpdateHouse('h1'));
    result.current.mutate({ name: 'Casa Nova' } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.houses.update).toHaveBeenCalledWith('h1', { name: 'Casa Nova' });
  });

  it('useRequestCapacityChange cria pedido (não aplica direto)', async () => {
    m.houses.createCapacityRequest.mockResolvedValue({ id: 'req1' });
    const { result } = renderHookWithClient(() => useRequestCapacityChange('h1'));
    result.current.mutate({ requestedBeds: 12 } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.houses.createCapacityRequest).toHaveBeenCalledWith('h1', { requestedBeds: 12 });
  });

  it('useRemoveHousePhoto remove a foto', async () => {
    m.houses.deletePhoto.mockResolvedValue(undefined);
    const { result } = renderHookWithClient(() => useRemoveHousePhoto('h1'));
    result.current.mutate('photo-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.houses.deletePhoto).toHaveBeenCalledWith('h1', 'photo-1');
  });

  it('useAddHousePhoto faz upload (web monta FormData via fetch().blob())', async () => {
    const origOS = Platform.OS;
    // @ts-expect-error força ramo web
    Platform.OS = 'web';
    global.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(new Blob(['x'])) }) as never;
    m.houses.addPhoto.mockResolvedValue({ id: 'photo-1' });
    const { result } = renderHookWithClient(() => useAddHousePhoto('h1'));
    result.current.mutate({ uri: 'blob:x', type: 'image/jpeg' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.houses.addPhoto).toHaveBeenCalledWith('h1', expect.any(FormData));
    // @ts-expect-error restaura
    Platform.OS = origOS;
  });
});

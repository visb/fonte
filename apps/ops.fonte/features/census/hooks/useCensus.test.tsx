import { waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { ResidentStatus } from '@fonte/types';

jest.mock('@/lib/api', () => ({
  api: {
    residents: { listByHouse: jest.fn(), update: jest.fn(), uploadPhoto: jest.fn() },
    houses: { list: jest.fn() },
    census: { addResident: jest.fn(), conclude: jest.fn() },
  },
}));

import { api } from '@/lib/api';
import { expectIdempotencyKey, renderHookWithClient } from '@/lib/test/utils';
import {
  useActiveResidentsByHouse,
  useCensusAddResident,
  useConcludeCensus,
} from './useCensus';

const m = api as unknown as {
  residents: Record<string, jest.Mock>;
  houses: Record<string, jest.Mock>;
  census: Record<string, jest.Mock>;
};

beforeEach(() => jest.clearAllMocks());

describe('useActiveResidentsByHouse', () => {
  it('filtra para ACTIVE + CENSUS_ADDED (esconde DISCHARGED/EVADED)', async () => {
    m.residents.listByHouse.mockResolvedValue([
      { id: 'r1', status: ResidentStatus.ACTIVE },
      { id: 'r2', status: ResidentStatus.CENSUS_ADDED },
      { id: 'r3', status: ResidentStatus.DISCHARGED },
    ]);
    const { result } = renderHookWithClient(() => useActiveResidentsByHouse('h1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('não dispara sem casa', () => {
    renderHookWithClient(() => useActiveResidentsByHouse(null));
    expect(m.residents.listByHouse).not.toHaveBeenCalled();
  });
});

describe('useCensusAddResident', () => {
  const origOS = Platform.OS;
  afterEach(() => {
    // @ts-expect-error restaura
    Platform.OS = origOS;
  });

  it('adiciona o residente sem foto', async () => {
    m.census.addResident.mockResolvedValue({ id: 'r1' });
    const { result } = renderHookWithClient(() => useCensusAddResident('h1'));
    result.current.mutate({ data: { name: 'Novo' } as never });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.census.addResident).toHaveBeenCalledWith({ name: 'Novo' }, expectIdempotencyKey);
    expect(m.residents.uploadPhoto).not.toHaveBeenCalled();
  });

  // Story 169, decisão 7: a foto vira uma segunda mutation, enfileirada só depois
  // de o filho existir — um FormData não pode depender de um id que ainda não há.
  it('adiciona com foto e encadeia o upload com o id criado', async () => {
    // @ts-expect-error força ramo web
    Platform.OS = 'web';
    global.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(new Blob(['x'])) }) as never;
    m.census.addResident.mockResolvedValue({ id: 'r1' });
    m.residents.uploadPhoto.mockResolvedValue({});
    const { result } = renderHookWithClient(() => useCensusAddResident('h1'));
    result.current.mutate({ data: { name: 'Novo' } as never, photo: { uri: 'blob:x', type: 'image/jpeg' } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() =>
      expect(m.residents.uploadPhoto).toHaveBeenCalledWith('r1', expect.any(FormData)),
    );
  });
});

describe('mutations de transição de status', () => {
  it('useConcludeCensus conclui', async () => {
    m.census.conclude.mockResolvedValue({});
    const { result } = renderHookWithClient(() => useConcludeCensus('h1'));
    result.current.mutate({ houseId: 'h1' } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.census.conclude).toHaveBeenCalledWith({ houseId: 'h1' }, expectIdempotencyKey);
  });

  // Alta/evasão/transferência e `useHouses` migraram para
  // `features/residents/hooks/useResidentRemoval.ts` (story 196) — os specs
  // foram junto, em `useResidentRemoval.test.tsx`.
});

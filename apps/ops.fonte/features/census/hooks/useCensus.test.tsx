import { waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { ResidentStatus } from '@fonte/types';

jest.mock('@/lib/api', () => ({
  api: {
    residents: {
      listByHouse: jest.fn(),
      update: jest.fn(),
      uploadPhoto: jest.fn(),
      lookup: jest.fn(),
      readmit: jest.fn(),
    },
    houses: { list: jest.fn() },
    census: { addResident: jest.fn(), conclude: jest.fn() },
  },
}));

import { api } from '@/lib/api';
import { expectIdempotencyKey, renderHookWithClient } from '@/lib/test/utils';
import {
  useActiveResidentsByHouse,
  useCensusAddResident,
  useCensusReadmit,
  useConcludeCensus,
  useFindReadmitCandidate,
  useResidentLookup,
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

describe('busca de reacolhimento (story 218)', () => {
  const candidate = { id: 'r9', name: 'Pedro', status: ResidentStatus.ARCHIVED };

  it('useResidentLookup busca com o termo aparado', async () => {
    m.residents.lookup.mockResolvedValue([candidate]);
    const { result } = renderHookWithClient(() => useResidentLookup('  ped  '));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.residents.lookup).toHaveBeenCalledWith('ped');
    expect(result.current.data).toEqual([candidate]);
  });

  it('useResidentLookup não dispara com menos de 3 caracteres nem desabilitado', () => {
    renderHookWithClient(() => useResidentLookup('pe'));
    renderHookWithClient(() => useResidentLookup('pedro', { enabled: false }));
    expect(m.residents.lookup).not.toHaveBeenCalled();
  });

  it('useFindReadmitCandidate acha o dono do CPF entre os candidatos', async () => {
    m.residents.lookup.mockResolvedValue([{ ...candidate, id: 'outro' }, candidate]);
    const { result } = renderHookWithClient(() => useFindReadmitCandidate());
    await expect(result.current('52998224725', 'r9')).resolves.toEqual(candidate);
    expect(m.residents.lookup).toHaveBeenCalledWith('52998224725');
  });

  it('useFindReadmitCandidate devolve null se o dono não é candidato ou a busca falha', async () => {
    m.residents.lookup.mockResolvedValueOnce([candidate]);
    const { result } = renderHookWithClient(() => useFindReadmitCandidate());
    await expect(result.current('11111111111', 'ativo')).resolves.toBeNull();
    m.residents.lookup.mockRejectedValueOnce(new Error('sem rede'));
    await expect(result.current('22222222222', 'r9')).resolves.toBeNull();
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

  it('useCensusReadmit reacolhe com payload mínimo e Idempotency-Key (story 218)', async () => {
    m.residents.readmit.mockResolvedValue({ id: 'r9' });
    const { result } = renderHookWithClient(() => useCensusReadmit('h1'));
    result.current.mutate({ residentId: 'r9', residentName: 'Pedro', entryDate: '2026-10-01' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.residents.readmit).toHaveBeenCalledWith(
      'r9',
      { houseId: 'h1', entryDate: '2026-10-01' },
      expectIdempotencyKey,
    );
  });

  // Alta/evasão/transferência e `useHouses` migraram para
  // `features/residents/hooks/useResidentRemoval.ts` (story 196) — os specs
  // foram junto, em `useResidentRemoval.test.tsx`.
});

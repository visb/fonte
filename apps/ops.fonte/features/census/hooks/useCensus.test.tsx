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
import { renderHookWithClient } from '@/lib/test/utils';
import {
  useActiveResidentsByHouse,
  useHouses,
  useCensusAddResident,
  useConcludeCensus,
  useDischargeResident,
  useEvadeResident,
  useTransferResident,
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

describe('useHouses', () => {
  it('lista as casas', async () => {
    m.houses.list.mockResolvedValue([{ id: 'h1' }]);
    const { result } = renderHookWithClient(() => useHouses());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.houses.list).toHaveBeenCalled();
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
    expect(m.census.addResident).toHaveBeenCalledWith({ name: 'Novo' });
    expect(m.residents.uploadPhoto).not.toHaveBeenCalled();
  });

  it('adiciona com foto (web: monta FormData via fetch().blob())', async () => {
    // @ts-expect-error força ramo web
    Platform.OS = 'web';
    global.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(new Blob(['x'])) }) as never;
    m.census.addResident.mockResolvedValue({ id: 'r1' });
    m.residents.uploadPhoto.mockResolvedValue({});
    const { result } = renderHookWithClient(() => useCensusAddResident('h1'));
    result.current.mutate({ data: { name: 'Novo' } as never, photo: { uri: 'blob:x', type: 'image/jpeg' } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.residents.uploadPhoto).toHaveBeenCalledWith('r1', expect.any(FormData));
  });
});

describe('mutations de transição de status', () => {
  it('useConcludeCensus conclui', async () => {
    m.census.conclude.mockResolvedValue({});
    const { result } = renderHookWithClient(() => useConcludeCensus('h1'));
    result.current.mutate({ houseId: 'h1' } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.census.conclude).toHaveBeenCalledWith({ houseId: 'h1' });
  });

  it('useDischargeResident atualiza para DISCHARGED + exitDate', async () => {
    m.residents.update.mockResolvedValue({});
    const { result } = renderHookWithClient(() => useDischargeResident('h1'));
    result.current.mutate({ residentId: 'r1', exitDate: '2026-06-23' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.residents.update).toHaveBeenCalledWith('r1', {
      status: ResidentStatus.DISCHARGED,
      exitDate: '2026-06-23',
    });
  });

  it('useEvadeResident atualiza para EVADED + exitDate', async () => {
    m.residents.update.mockResolvedValue({});
    const { result } = renderHookWithClient(() => useEvadeResident('h1'));
    result.current.mutate({ residentId: 'r1', exitDate: '2026-06-23' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.residents.update).toHaveBeenCalledWith('r1', {
      status: ResidentStatus.EVADED,
      exitDate: '2026-06-23',
    });
  });

  it('useTransferResident move para outra casa mantendo ACTIVE', async () => {
    m.residents.update.mockResolvedValue({});
    const { result } = renderHookWithClient(() => useTransferResident('h1'));
    result.current.mutate({ residentId: 'r1', targetHouseId: 'h2' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.residents.update).toHaveBeenCalledWith('r1', { houseId: 'h2' });
  });
});

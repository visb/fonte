import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    houses: {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      listStaff: vi.fn(),
      listResidents: vi.fn(),
      addPhoto: vi.fn(),
      deletePhoto: vi.fn(),
      listCapacityRequests: vi.fn(),
      getCapacityRequest: vi.fn(),
      approveCapacityRequest: vi.fn(),
      rejectCapacityRequest: vi.fn(),
    },
    storeroom: { listItems: vi.fn(), listMovements: vi.fn() },
    supplyRoom: { listItems: vi.fn(), listMovements: vi.fn() },
  },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithClient } from '@/test/utils';
import {
  useHouses,
  useHouseById,
  useCreateHouse,
  useUpdateHouse,
  useDeleteHouse,
  useHouseStaff,
  useHouseResidents,
  useUploadHousePhoto,
  useDeleteHousePhoto,
  useHouseStoreroomItems,
  useHouseStoreroomMovements,
  useHouseSupplyRoomItems,
  useHouseSupplyRoomMovements,
  useCapacityRequestHistory,
  useCapacityRequest,
  useApproveCapacityRequest,
  useRejectCapacityRequest,
} from './useHouses';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('queries de casa', () => {
  it('list usa houses.all', async () => {
    vi.mocked(api.houses.list).mockResolvedValue([{ id: 'h1' }] as never);
    const { result, queryClient } = renderHookWithClient(() => useHouses());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(queryKeys.houses.all)).toEqual([{ id: 'h1' }]);
  });

  it('getById desliga sem id', () => {
    const { result } = renderHookWithClient(() => useHouseById(''));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('staff/residents respeitam enabled', async () => {
    const { result } = renderHookWithClient(() => useHouseStaff('h1', { enabled: false }));
    expect(result.current.fetchStatus).toBe('idle');

    vi.mocked(api.houses.listResidents).mockResolvedValue([] as never);
    const { result: r2 } = renderHookWithClient(() => useHouseResidents('h1'));
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));
    expect(api.houses.listResidents).toHaveBeenCalledWith('h1');
  });

  it('storeroom e supplyRoom buscam por casa', async () => {
    vi.mocked(api.storeroom.listItems).mockResolvedValue([] as never);
    vi.mocked(api.storeroom.listMovements).mockResolvedValue([] as never);
    vi.mocked(api.supplyRoom.listItems).mockResolvedValue([] as never);
    vi.mocked(api.supplyRoom.listMovements).mockResolvedValue([] as never);

    const { result: a } = renderHookWithClient(() => useHouseStoreroomItems('h1'));
    await waitFor(() => expect(a.current.isSuccess).toBe(true));
    expect(api.storeroom.listItems).toHaveBeenCalledWith({ houseId: 'h1' });

    const { result: b } = renderHookWithClient(() => useHouseStoreroomMovements('h1'));
    await waitFor(() => expect(b.current.isSuccess).toBe(true));

    const { result: c } = renderHookWithClient(() => useHouseSupplyRoomItems('h1'));
    await waitFor(() => expect(c.current.isSuccess).toBe(true));

    const { result: d } = renderHookWithClient(() => useHouseSupplyRoomMovements('h1'));
    await waitFor(() => expect(d.current.isSuccess).toBe(true));
  });

  it('capacityRequest desliga sem requestId', () => {
    const { result } = renderHookWithClient(() => useCapacityRequest(null));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('capacityRequestHistory busca por casa', async () => {
    vi.mocked(api.houses.listCapacityRequests).mockResolvedValue([] as never);
    const { result } = renderHookWithClient(() => useCapacityRequestHistory('h1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.houses.listCapacityRequests).toHaveBeenCalledWith('h1');
  });
});

describe('mutations de casa', () => {
  it('create / update / delete invalidam houses', async () => {
    vi.mocked(api.houses.create).mockResolvedValue({ id: 'h1' } as never);
    vi.mocked(api.houses.update).mockResolvedValue({ id: 'h1' } as never);
    vi.mocked(api.houses.delete).mockResolvedValue(undefined as never);

    const { result: c, queryClient } = renderHookWithClient(() => useCreateHouse());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    c.current.mutate({ name: 'Nova' } as never);
    await waitFor(() => expect(c.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.houses.all });

    const { result: u } = renderHookWithClient(() => useUpdateHouse('h1'));
    u.current.mutate({ name: 'Edit' } as never);
    await waitFor(() => expect(u.current.isSuccess).toBe(true));
    expect(api.houses.update).toHaveBeenCalledWith('h1', { name: 'Edit' });

    const { result: d } = renderHookWithClient(() => useDeleteHouse());
    d.current.mutate('h1');
    await waitFor(() => expect(d.current.isSuccess).toBe(true));
    expect(api.houses.delete).toHaveBeenCalledWith('h1');
  });

  it('upload/delete foto invalidam o detalhe', async () => {
    vi.mocked(api.houses.addPhoto).mockResolvedValue({} as never);
    vi.mocked(api.houses.deletePhoto).mockResolvedValue(undefined as never);

    const { result, queryClient } = renderHookWithClient(() => useUploadHousePhoto('h1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate(new File(['x'], 'f.jpg'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.houses.addPhoto).toHaveBeenCalledWith('h1', expect.any(FormData));
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.houses.detail('h1') });

    const { result: del } = renderHookWithClient(() => useDeleteHousePhoto('h1'));
    del.current.mutate('photo1');
    await waitFor(() => expect(del.current.isSuccess).toBe(true));
    expect(api.houses.deletePhoto).toHaveBeenCalledWith('h1', 'photo1');
  });

  it('approve/reject capacity invalidam notificações + casa', async () => {
    const request = { id: 'req1', houseId: 'h1' };
    vi.mocked(api.houses.approveCapacityRequest).mockResolvedValue(request as never);
    vi.mocked(api.houses.rejectCapacityRequest).mockResolvedValue(request as never);

    const { result: ap, queryClient } = renderHookWithClient(() => useApproveCapacityRequest());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    ap.current.mutate('req1');
    await waitFor(() => expect(ap.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.notifications.all });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.houses.capacityRequest('req1') });

    const { result: rj } = renderHookWithClient(() => useRejectCapacityRequest());
    rj.current.mutate('req1');
    await waitFor(() => expect(rj.current.isSuccess).toBe(true));
    expect(api.houses.rejectCapacityRequest).toHaveBeenCalledWith('req1');
  });
});

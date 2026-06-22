import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    houses: {
      listMinistries: vi.fn(),
      addMinistry: vi.fn(),
      listRules: vi.fn(),
      createRule: vi.fn(),
      deleteRule: vi.fn(),
    },
    ministries: {
      update: vi.fn(),
      addResident: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { renderHookWithClient } from '@/test/utils';
import {
  useHouseMinistriesList,
  useCreateHouseMinistry,
  useUpdateMinistryLeader,
  useRemoveMinistry,
} from './useHouseMinistries';
import { useHouseRules, useCreateRule, useDeleteRule } from './useHouseRules';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe('ministérios', () => {
  it('lista por casa', async () => {
    vi.mocked(api.houses.listMinistries).mockResolvedValue([] as never);
    const { result } = renderHookWithClient(() => useHouseMinistriesList('h1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.houses.listMinistries).toHaveBeenCalledWith('h1');
  });

  it('create cria, define líder e adiciona residentes, depois invalida', async () => {
    vi.mocked(api.houses.addMinistry).mockResolvedValue({ id: 'm1' } as never);
    vi.mocked(api.ministries.update).mockResolvedValue({} as never);
    vi.mocked(api.ministries.addResident).mockResolvedValue({} as never);

    const { result, queryClient } = renderHookWithClient(() => useCreateHouseMinistry('h1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate({
      name: 'Cozinha',
      leaderId: 's1',
      leaderType: 'STAFF',
      residentIds: ['r1', 'r2'],
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.houses.addMinistry).toHaveBeenCalledWith('h1', { name: 'Cozinha' });
    expect(api.ministries.update).toHaveBeenCalledWith('m1', { leaderId: 's1', leaderType: 'STAFF' });
    expect(api.ministries.addResident).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.houses.ministries('h1') });
  });

  it('create sem líder nem residentes só cria', async () => {
    vi.mocked(api.houses.addMinistry).mockResolvedValue({ id: 'm1' } as never);
    const { result } = renderHookWithClient(() => useCreateHouseMinistry('h1'));
    result.current.mutate({ name: 'Limpeza' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.ministries.update).not.toHaveBeenCalled();
    expect(api.ministries.addResident).not.toHaveBeenCalled();
  });

  it('updateLeader e remove invalidam ministérios', async () => {
    vi.mocked(api.ministries.update).mockResolvedValue({} as never);
    vi.mocked(api.ministries.delete).mockResolvedValue(undefined as never);

    const { result: u } = renderHookWithClient(() => useUpdateMinistryLeader('h1'));
    u.current.mutate({ ministryId: 'm1', leaderId: 'r1', leaderType: 'RESIDENT' });
    await waitFor(() => expect(u.current.isSuccess).toBe(true));
    expect(api.ministries.update).toHaveBeenCalledWith('m1', { leaderId: 'r1', leaderType: 'RESIDENT' });

    const { result: r } = renderHookWithClient(() => useRemoveMinistry('h1'));
    r.current.mutate('m1');
    await waitFor(() => expect(r.current.isSuccess).toBe(true));
    expect(api.ministries.delete).toHaveBeenCalledWith('m1');
  });
});

describe('regras', () => {
  it('lista, cria e remove invalidando rules', async () => {
    vi.mocked(api.houses.listRules).mockResolvedValue([] as never);
    const { result } = renderHookWithClient(() => useHouseRules('h1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.houses.listRules).toHaveBeenCalledWith('h1');

    vi.mocked(api.houses.createRule).mockResolvedValue({} as never);
    const { result: c, queryClient } = renderHookWithClient(() => useCreateRule('h1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    c.current.mutate({ text: 'Silêncio às 22h' } as never);
    await waitFor(() => expect(c.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.houses.rules('h1') });

    vi.mocked(api.houses.deleteRule).mockResolvedValue(undefined as never);
    const { result: d } = renderHookWithClient(() => useDeleteRule('h1'));
    d.current.mutate('rule1');
    await waitFor(() => expect(d.current.isSuccess).toBe(true));
    expect(api.houses.deleteRule).toHaveBeenCalledWith('h1', 'rule1');
  });
});

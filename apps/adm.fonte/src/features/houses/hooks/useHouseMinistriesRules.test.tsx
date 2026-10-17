import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    houses: {
      listMinistries: vi.fn(),
      listResidents: vi.fn(),
      addMinistry: vi.fn(),
      listRules: vi.fn(),
      createRule: vi.fn(),
      deleteRule: vi.fn(),
    },
    // Story 205: `addResident`/`removeResident` voltaram ao cliente.
    ministries: {
      getById: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      addResident: vi.fn(),
      removeResident: vi.fn(),
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
  useMinistryEligibleResidents,
  useMinistryDetail,
  useAddMinistryResident,
  useRemoveMinistryResident,
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

  it('lista desabilitada não busca', () => {
    renderHookWithClient(() => useHouseMinistriesList('h1', { enabled: false }));
    expect(api.houses.listMinistries).not.toHaveBeenCalled();
  });

  // Decisão 7 da 197, mantida na 205: o create não faz N `addResident` sem transação.
  it('create cria, define líder e invalida — sem chamada de membro', async () => {
    vi.mocked(api.houses.addMinistry).mockResolvedValue({ id: 'm1' } as never);
    vi.mocked(api.ministries.update).mockResolvedValue({} as never);

    const { result, queryClient } = renderHookWithClient(() => useCreateHouseMinistry('h1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    result.current.mutate({ name: 'Cozinha', leaderId: 'r1', leaderType: 'RESIDENT' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.houses.addMinistry).toHaveBeenCalledWith('h1', { name: 'Cozinha' });
    expect(api.ministries.update).toHaveBeenCalledWith('m1', { leaderId: 'r1', leaderType: 'RESIDENT' });
    expect(api.ministries.addResident).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.houses.ministries('h1') });
  });

  it('create sem líder só cria', async () => {
    vi.mocked(api.houses.addMinistry).mockResolvedValue({ id: 'm1' } as never);
    const { result } = renderHookWithClient(() => useCreateHouseMinistry('h1'));
    result.current.mutate({ name: 'Limpeza' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.ministries.update).not.toHaveBeenCalled();
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

describe('filhos do ministério (story 205)', () => {
  it('elegíveis: só filhos em acolhimento da casa (filho com alta some)', async () => {
    vi.mocked(api.houses.listResidents).mockResolvedValue([
      { id: 'r1', name: 'Ativo', status: 'ACTIVE' },
      { id: 'r2', name: 'Alta', status: 'DISCHARGED' },
      { id: 'r3', name: 'Disciplina', status: 'DISCIPLINE' },
      { id: 'r4', name: 'Evadido', status: 'EVADED' },
    ] as never);
    const { result } = renderHookWithClient(() => useMinistryEligibleResidents('h1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.map((r) => r.id)).toEqual(['r1', 'r3']);
  });

  it('detalhe do ministério só busca com id', async () => {
    vi.mocked(api.ministries.getById).mockResolvedValue({ id: 'm1', members: [] } as never);
    renderHookWithClient(() => useMinistryDetail(null));
    expect(api.ministries.getById).not.toHaveBeenCalled();
    const { result } = renderHookWithClient(() => useMinistryDetail('m1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.ministries.getById).toHaveBeenCalledWith('m1');
  });

  it('adicionar e remover filho chamam a API e invalidam detalhe, lista e fichas', async () => {
    vi.mocked(api.ministries.addResident).mockResolvedValue({} as never);
    vi.mocked(api.ministries.removeResident).mockResolvedValue({} as never);

    const { result: add, queryClient } = renderHookWithClient(() => useAddMinistryResident('h1', 'm1'));
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    add.current.mutate('r1');
    await waitFor(() => expect(add.current.isSuccess).toBe(true));
    expect(api.ministries.addResident).toHaveBeenCalledWith('m1', 'r1');
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.ministries.detail('m1') });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.houses.ministries('h1') });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.residents.all });

    const { result: rm } = renderHookWithClient(() => useRemoveMinistryResident('h1', 'm1'));
    rm.current.mutate('r1');
    await waitFor(() => expect(rm.current.isSuccess).toBe(true));
    expect(api.ministries.removeResident).toHaveBeenCalledWith('m1', 'r1');
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

import { waitFor } from '@testing-library/react-native';

jest.mock('@/lib/api', () => ({
  api: {
    houses: {
      listStaff: jest.fn(),
      listMinistries: jest.fn(),
      addMinistry: jest.fn(),
    },
    residents: { listByHouse: jest.fn() },
    ministries: {
      addResident: jest.fn(),
      removeResident: jest.fn(),
      getById: jest.fn(),
      listTasks: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      addStaff: jest.fn(),
      removeStaff: jest.fn(),
      createTask: jest.fn(),
      updateTask: jest.fn(),
      deleteTask: jest.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { createTestQueryClient, renderHookWithClient } from '@/lib/test/utils';
import { queryKeys } from '@/lib/queryKeys';
import {
  useMinistries,
  useMinistryDetail,
  useMinistryTasks,
  useCreateMinistry,
  useUpdateMinistry,
  useDeleteMinistry,
  useAddStaff,
  useRemoveStaff,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useMinistryEligibleResidents,
  useAddResident,
  useRemoveResident,
} from './useMinistries';

const m = api as unknown as {
  houses: Record<string, jest.Mock>;
  residents: Record<string, jest.Mock>;
  ministries: Record<string, jest.Mock>;
};

beforeEach(() => jest.clearAllMocks());

describe('useMinistries — queries', () => {
  it.each([
    ['useMinistries', () => useMinistries('h1'), () => m.houses.listMinistries],
  ])('%s busca quando houseId presente', async (_n, hook, getFn) => {
    getFn().mockResolvedValue([]);
    const { result } = renderHookWithClient(hook as never);
    await waitFor(() => expect((result.current as { isSuccess: boolean }).isSuccess).toBe(true));
    expect(getFn()).toHaveBeenCalledWith('h1');
  });

  it('queries não disparam sem houseId', () => {
    renderHookWithClient(() => useMinistries(null));
    expect(m.houses.listMinistries).not.toHaveBeenCalled();
  });

  it('useMinistryDetail busca por id', async () => {
    m.ministries.getById.mockResolvedValue({ id: 'min1' });
    const { result } = renderHookWithClient(() => useMinistryDetail('min1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.ministries.getById).toHaveBeenCalledWith('min1');
  });

  it('useMinistryTasks busca tarefas', async () => {
    m.ministries.listTasks.mockResolvedValue([]);
    const { result } = renderHookWithClient(() => useMinistryTasks('min1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.ministries.listTasks).toHaveBeenCalledWith('min1');
  });
});

describe('useCreateMinistry', () => {
  it('cria o ministério e define o líder servo', async () => {
    m.houses.addMinistry.mockResolvedValue({ id: 'min1' });
    m.ministries.update.mockResolvedValue({});
    const { result } = renderHookWithClient(() => useCreateMinistry('h1'));
    result.current.mutate({
      name: 'Cozinha',
      leaderId: 'staff-1',
      leaderType: 'STAFF',
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.houses.addMinistry).toHaveBeenCalledWith('h1', { name: 'Cozinha' });
    expect(m.ministries.update).toHaveBeenCalledWith('min1', { leaderId: 'staff-1', leaderType: 'STAFF' });
  });

  it('cria sem líder (só addMinistry)', async () => {
    m.houses.addMinistry.mockResolvedValue({ id: 'min1' });
    const { result } = renderHookWithClient(() => useCreateMinistry('h1'));
    result.current.mutate({ name: 'Limpeza' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.ministries.update).not.toHaveBeenCalled();
  });

  it('cria com líder filho (RESIDENT) e não adiciona membros em lote', async () => {
    m.houses.addMinistry.mockResolvedValue({ id: 'min1' });
    m.ministries.update.mockResolvedValue({});
    const { result } = renderHookWithClient(() => useCreateMinistry('h1'));
    result.current.mutate({ name: 'Horta', leaderId: 'r1', leaderType: 'RESIDENT' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.ministries.update).toHaveBeenCalledWith('min1', { leaderId: 'r1', leaderType: 'RESIDENT' });
    expect(m.ministries.addResident).not.toHaveBeenCalled();
  });
});

describe('Story 205 — filhos do ministério', () => {
  it('useMinistryEligibleResidents filtra só filhos em acolhimento (alta/evasão/pré somem)', async () => {
    m.residents.listByHouse.mockResolvedValue([
      { id: 'r1', status: 'ACTIVE' },
      { id: 'r2', status: 'DISCIPLINE' },
      { id: 'r3', status: 'TEMP_LEAVE' },
      { id: 'r4', status: 'DISCHARGED' },
      { id: 'r5', status: 'EVADED' },
      { id: 'r6', status: 'PRE_ADMISSION' },
      { id: 'r7', status: 'CENSUS_ADDED' },
    ]);
    const { result } = renderHookWithClient(() => useMinistryEligibleResidents('h1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
  });

  it('useMinistryEligibleResidents lê a lista da casa do cache (store local), sem rede', () => {
    const client = createTestQueryClient();
    client.setDefaultOptions({ queries: { retry: false, staleTime: Infinity } });
    client.setQueryData(queryKeys.residents.byHouse('h1'), [
      { id: 'r1', status: 'ACTIVE' },
      { id: 'r4', status: 'DISCHARGED' },
    ]);
    const { result } = renderHookWithClient(() => useMinistryEligibleResidents('h1'), client);
    expect(result.current.data!.map((r) => r.id)).toEqual(['r1']);
    expect(m.residents.listByHouse).not.toHaveBeenCalled();
  });

  it('useMinistryEligibleResidents sem casa não busca', () => {
    renderHookWithClient(() => useMinistryEligibleResidents(undefined));
    expect(m.residents.listByHouse).not.toHaveBeenCalled();
  });

  it.each([
    ['useAddResident', () => useAddResident('min1', 'h1'), () => m.ministries.addResident],
    ['useRemoveResident', () => useRemoveResident('min1', 'h1'), () => m.ministries.removeResident],
  ])('%s chama a API e invalida ministério, lista da casa e ficha do filho', async (_n, hook, getFn) => {
    getFn().mockResolvedValue({});
    const client = createTestQueryClient();
    const spy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHookWithClient(hook as never, client);
    (result.current as { mutate: (a: unknown) => void }).mutate('r1');
    await waitFor(() => expect((result.current as { isSuccess: boolean }).isSuccess).toBe(true));
    expect(getFn()).toHaveBeenCalledWith('min1', 'r1');
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.ministries.detail('min1') });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.ministries.byHouse('h1') });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.houses.ministries('h1') });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.residents.detail('r1') });
  });
});

describe('useMinistries — mutations diretas', () => {
  it.each([
    ['useUpdateMinistry', () => useUpdateMinistry('min1', 'h1'), { name: 'novo' }, () => m.ministries.update, ['min1', { name: 'novo' }]],
    ['useDeleteMinistry', () => useDeleteMinistry('h1'), 'min1', () => m.ministries.delete, ['min1']],
    ['useAddStaff', () => useAddStaff('min1'), 's1', () => m.ministries.addStaff, ['min1', 's1']],
    ['useRemoveStaff', () => useRemoveStaff('min1'), 's1', () => m.ministries.removeStaff, ['min1', 's1']],
    ['useDeleteTask', () => useDeleteTask('min1'), 't1', () => m.ministries.deleteTask, ['min1', 't1']],
  ])('%s chama o api-client com os args certos', async (_n, hook, arg, getFn, expected) => {
    getFn().mockResolvedValue({});
    const { result } = renderHookWithClient(hook as never);
    (result.current as { mutate: (a: unknown) => void }).mutate(arg);
    await waitFor(() => expect((result.current as { isSuccess: boolean }).isSuccess).toBe(true));
    expect(getFn()).toHaveBeenCalledWith(...(expected as unknown[]));
  });

  it('useCreateTask cria a tarefa', async () => {
    m.ministries.createTask.mockResolvedValue({});
    const { result } = renderHookWithClient(() => useCreateTask('min1'));
    result.current.mutate({ title: 'Lavar', repetition: 'DAILY' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.ministries.createTask).toHaveBeenCalledWith('min1', { title: 'Lavar', repetition: 'DAILY' });
  });

  // Story 204: a lista de servos traz os ministérios liderados — mexer em
  // ministério invalida `staff.byHouse` da casa.
  it.each([
    ['useCreateMinistry', () => useCreateMinistry('h1'), { name: 'Horta' }, () => m.houses.addMinistry],
    ['useUpdateMinistry', () => useUpdateMinistry('min1', 'h1'), { leaderId: 's1', leaderType: 'STAFF' }, () => m.ministries.update],
    ['useDeleteMinistry', () => useDeleteMinistry('h1'), 'min1', () => m.ministries.delete],
  ])('%s invalida os servos da casa', async (_n, hook, arg, getFn) => {
    getFn().mockResolvedValue({ id: 'min1' });
    const client = createTestQueryClient();
    const spy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHookWithClient(hook as never, client);
    (result.current as { mutate: (a: unknown) => void }).mutate(arg);
    await waitFor(() => expect((result.current as { isSuccess: boolean }).isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.staff.byHouse('h1') });
  });

  it('useUpdateTask atualiza a tarefa', async () => {
    m.ministries.updateTask.mockResolvedValue({});
    const { result } = renderHookWithClient(() => useUpdateTask('min1'));
    result.current.mutate({ taskId: 't1', data: { completed: true } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.ministries.updateTask).toHaveBeenCalledWith('min1', 't1', { completed: true });
  });
});

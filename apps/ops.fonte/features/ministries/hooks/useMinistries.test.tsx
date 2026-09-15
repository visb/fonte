import { waitFor } from '@testing-library/react-native';

jest.mock('@/lib/api', () => ({
  api: {
    houses: {
      listStaff: jest.fn(),
      listMinistries: jest.fn(),
      addMinistry: jest.fn(),
    },
    ministries: {
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
import { renderHookWithClient } from '@/lib/test/utils';
import {
  useHouseStaffForMinistry,
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
} from './useMinistries';

const m = api as unknown as {
  houses: Record<string, jest.Mock>;
  ministries: Record<string, jest.Mock>;
};

beforeEach(() => jest.clearAllMocks());

describe('useMinistries — queries', () => {
  it.each([
    ['useHouseStaffForMinistry', () => useHouseStaffForMinistry('h1'), () => m.houses.listStaff],
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

  // Story 197: o vínculo filho↔ministério não existe mais — o api-client não
  // expõe as rotas de membro filho.
  it('o api-client não tem mais addResident/removeResident de ministério', () => {
    expect(m.ministries.addResident).toBeUndefined();
    expect(m.ministries.removeResident).toBeUndefined();
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

  it('useUpdateTask atualiza a tarefa', async () => {
    m.ministries.updateTask.mockResolvedValue({});
    const { result } = renderHookWithClient(() => useUpdateTask('min1'));
    result.current.mutate({ taskId: 't1', data: { completed: true } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.ministries.updateTask).toHaveBeenCalledWith('min1', 't1', { completed: true });
  });
});

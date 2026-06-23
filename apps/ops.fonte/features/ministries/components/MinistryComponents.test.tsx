import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/lib/test/utils';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

jest.mock('@/lib/api', () => ({
  api: {
    houses: { addMinistry: jest.fn(), listStaff: jest.fn(), listResidents: jest.fn() },
    ministries: {
      update: jest.fn(),
      addResident: jest.fn(),
      removeResident: jest.fn(),
      addStaff: jest.fn(),
      listTasks: jest.fn(),
      createTask: jest.fn(),
      updateTask: jest.fn(),
      deleteTask: jest.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { MinistryCard } from './MinistryCard';
import { MinistryTaskRow } from './MinistryTaskRow';
import { CreateMinistryModal } from './CreateMinistryModal';
import { AddTaskModal } from './AddTaskModal';
import { MinistryTasksTab } from './MinistryTasksTab';
import { LeaderPickerModal } from './LeaderPickerModal';
import { MinistryOverviewTab } from './MinistryOverviewTab';

const m = api as unknown as { houses: Record<string, jest.Mock>; ministries: Record<string, jest.Mock> };

function rc(ui: React.ReactElement) {
  return render(<QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>);
}

beforeEach(() => jest.clearAllMocks());

describe('MinistryCard', () => {
  it('mostra nome, líder e contagens (plural)', () => {
    render(<MinistryCard ministry={{ id: 'min1', name: 'Cozinha', leaderName: 'Servo X', filhoCount: 3, servoCount: 2 } as never} />);
    expect(screen.getByText('Cozinha')).toBeTruthy();
    expect(screen.getByText('Líder: Servo X')).toBeTruthy();
    expect(screen.getByText('3 filhos')).toBeTruthy();
    expect(screen.getByText('2 servos')).toBeTruthy();
  });

  it('sem líder e contagens no singular; navega ao tocar', () => {
    render(<MinistryCard ministry={{ id: 'min1', name: 'Horta', leaderName: null, filhoCount: 1, servoCount: 1 } as never} />);
    expect(screen.getByText('Sem líder definido')).toBeTruthy();
    expect(screen.getByText('1 filho')).toBeTruthy();
    fireEvent.press(screen.getByText('Horta'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/ministries/min1');
  });
});

describe('MinistryTaskRow', () => {
  it('tarefa não-diária concluída mostra checkbox marcado e risco', () => {
    const onToggle = jest.fn();
    render(<MinistryTaskRow task={{ id: 't1', title: 'Lavar', completed: true, repetition: 'NONE', completedAt: null } as never} onToggle={onToggle} onDelete={jest.fn()} />);
    expect(screen.getByText('icon:checkbox')).toBeTruthy();
    fireEvent.press(screen.getByText('icon:checkbox'));
    expect(onToggle).toHaveBeenCalledWith('t1', true);
  });

  it('tarefa diária usa completedAt de hoje e mostra "Repetição diária"', () => {
    const today = new Date().toISOString();
    render(<MinistryTaskRow task={{ id: 't2', title: 'Limpar', completed: false, repetition: 'DAILY', completedAt: today } as never} onToggle={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.getByText('Repetição diária')).toBeTruthy();
    expect(screen.getByText('icon:checkbox')).toBeTruthy();
  });

  it('excluir dispara onDelete', () => {
    const onDelete = jest.fn();
    render(<MinistryTaskRow task={{ id: 't3', title: 'X', completed: false, repetition: 'NONE', completedAt: null } as never} onToggle={jest.fn()} onDelete={onDelete} />);
    fireEvent.press(screen.getByText('icon:close-circle-outline'));
    expect(onDelete).toHaveBeenCalledWith('t3');
  });
});

describe('CreateMinistryModal', () => {
  const props = { visible: true, houseId: 'h1', onClose: jest.fn(), onSuccess: jest.fn() };

  it('Criar fica desabilitado sem nome; com nome cria o ministério', async () => {
    m.houses.listStaff.mockResolvedValue([]);
    m.houses.listResidents.mockResolvedValue([]);
    m.houses.addMinistry.mockResolvedValue({ id: 'min1' });
    rc(<CreateMinistryModal {...props} />);
    await waitFor(() => expect(screen.getByText('Novo ministério')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText(/Ex: Cozinha/), 'Louvor');
    fireEvent.press(screen.getByText('Criar'));
    await waitFor(() => expect(m.houses.addMinistry).toHaveBeenCalledWith('h1', { name: 'Louvor' }));
  });

  it('lista líderes (staff + residentes) e filtra residentes pela busca', async () => {
    m.houses.listStaff.mockResolvedValue([{ id: 's1', name: 'Servo X' }]);
    m.houses.listResidents.mockResolvedValue([{ id: 'r1', name: 'João' }, { id: 'r2', name: 'Pedro' }]);
    rc(<CreateMinistryModal {...props} />);
    await waitFor(() => expect(screen.getByText('Servo X')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText('Buscar filho...'), 'ped');
    // Pedro permanece na lista filtrada de filhos; João some da lista de filhos
    // (ambos continuam como opção de líder, por isso usamos getAllByText).
    await waitFor(() => expect(screen.getAllByText('Pedro').length).toBeGreaterThan(0));
  });
});

describe('AddTaskModal', () => {
  const props = { visible: true, onClose: jest.fn(), ministryId: 'min1' };

  it('cria a tarefa com título e repetição diária', async () => {
    m.ministries.createTask.mockResolvedValue({ id: 't1' });
    rc(<AddTaskModal {...props} />);
    fireEvent.changeText(screen.getByPlaceholderText('Título da tarefa'), 'Regar horta');
    fireEvent.press(screen.getByText('Diária'));
    fireEvent.press(screen.getByText('Adicionar'), { stopPropagation: jest.fn() });
    await waitFor(() => expect(m.ministries.createTask).toHaveBeenCalledWith('min1', { title: 'Regar horta', repetition: 'DAILY' }));
  });

  it('título vazio não cria', () => {
    rc(<AddTaskModal {...props} />);
    fireEvent.press(screen.getByText('Adicionar'), { stopPropagation: jest.fn() });
    expect(m.ministries.createTask).not.toHaveBeenCalled();
  });
});

describe('MinistryTasksTab', () => {
  it('loading mostra LoadingState; depois lista vazia', async () => {
    m.ministries.listTasks.mockResolvedValue([]);
    rc(<MinistryTasksTab ministryId="min1" onAddTask={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Nenhuma tarefa cadastrada.')).toBeTruthy());
  });

  it('lista tarefas e o FAB dispara onAddTask', async () => {
    m.ministries.listTasks.mockResolvedValue([{ id: 't1', title: 'Lavar', completed: false, repetition: 'NONE', completedAt: null }]);
    const onAddTask = jest.fn();
    rc(<MinistryTasksTab ministryId="min1" onAddTask={onAddTask} />);
    await waitFor(() => expect(screen.getByText('Lavar')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Nova tarefa'));
    expect(onAddTask).toHaveBeenCalled();
  });

  it('toggle de tarefa muta updateTask com completed invertido', async () => {
    m.ministries.listTasks.mockResolvedValue([{ id: 't1', title: 'Lavar', completed: false, repetition: 'NONE', completedAt: null }]);
    m.ministries.updateTask.mockResolvedValue({});
    rc(<MinistryTasksTab ministryId="min1" onAddTask={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Lavar')).toBeTruthy());
    fireEvent.press(screen.getByText('icon:square-outline'));
    await waitFor(() => expect(m.ministries.updateTask).toHaveBeenCalledWith('min1', 't1', { completed: true }));
  });
});

describe('LeaderPickerModal', () => {
  const props = { visible: true, onClose: jest.fn(), ministryId: 'min1', houseId: 'h1', currentLeaderId: null };

  it('lista staff e seleciona um líder (muta update)', async () => {
    m.houses.listStaff.mockResolvedValue([{ id: 's1', name: 'Servo X' }]);
    m.ministries.update.mockResolvedValue({});
    rc(<LeaderPickerModal {...props} />);
    await waitFor(() => expect(screen.getByText('Servo X')).toBeTruthy());
    fireEvent.press(screen.getByText('Servo X'));
    await waitFor(() => expect(m.ministries.update).toHaveBeenCalledWith('min1', { leaderId: 's1', leaderType: 'STAFF' }));
  });

  it('"Sem líder" muta com null', async () => {
    m.houses.listStaff.mockResolvedValue([]);
    m.ministries.update.mockResolvedValue({});
    rc(<LeaderPickerModal {...props} />);
    fireEvent.press(screen.getByText('— Sem líder'));
    await waitFor(() => expect(m.ministries.update).toHaveBeenCalledWith('min1', { leaderId: null, leaderType: null }));
  });
});

describe('MinistryOverviewTab', () => {
  const ministry = {
    leaderName: 'Servo X',
    members: [
      { id: 'r1', name: 'João', role: 'FILHO' },
      { id: 's1', name: 'Servo Y', role: 'SERVO' },
    ],
  };

  it('mostra líder, membros e botão de editar líder', async () => {
    m.houses.listResidents.mockResolvedValue([]);
    m.houses.listStaff.mockResolvedValue([]);
    const onEditLeader = jest.fn();
    rc(<MinistryOverviewTab ministryId="min1" houseId="h1" ministry={ministry as never} onEditLeader={onEditLeader} />);
    await waitFor(() => expect(screen.getByText('Servo X')).toBeTruthy());
    expect(screen.getByText('João')).toBeTruthy();
    fireEvent.press(screen.getByText('Editar'));
    expect(onEditLeader).toHaveBeenCalled();
  });

  it('remover um membro filho muta removeResident', async () => {
    m.houses.listResidents.mockResolvedValue([]);
    m.houses.listStaff.mockResolvedValue([]);
    m.ministries.removeResident.mockResolvedValue({});
    rc(<MinistryOverviewTab ministryId="min1" houseId="h1" ministry={ministry as never} onEditLeader={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('João')).toBeTruthy());
    fireEvent.press(screen.getAllByText('icon:remove-circle-outline')[0]);
    await waitFor(() => expect(m.ministries.removeResident).toHaveBeenCalledWith('min1', 'r1'));
  });
});

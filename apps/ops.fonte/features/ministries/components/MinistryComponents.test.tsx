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
    houses: { addMinistry: jest.fn(), listStaff: jest.fn() },
    ministries: {
      update: jest.fn(),
      addStaff: jest.fn(),
      removeStaff: jest.fn(),
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
  it('mostra nome, líder e contagem de servos (plural)', () => {
    render(<MinistryCard ministry={{ id: 'min1', name: 'Cozinha', leaderName: 'Servo X', servoCount: 2 } as never} />);
    expect(screen.getByText('Cozinha')).toBeTruthy();
    expect(screen.getByText('Líder: Servo X')).toBeTruthy();
    expect(screen.getByText('2 servos')).toBeTruthy();
  });

  // Story 197: o card não conta mais filhos — ministério é coisa de servo.
  it('sem líder, contagem no singular e sem contagem de filhos; navega ao tocar', () => {
    render(<MinistryCard ministry={{ id: 'min1', name: 'Horta', leaderName: null, servoCount: 1 } as never} />);
    expect(screen.getByText('Sem líder definido')).toBeTruthy();
    expect(screen.getByText('1 servo')).toBeTruthy();
    expect(screen.queryByText('1 filho')).toBeNull();
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
    m.houses.addMinistry.mockResolvedValue({ id: 'min1' });
    rc(<CreateMinistryModal {...props} />);
    await waitFor(() => expect(screen.getByText('Novo ministério')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText(/Ex: Cozinha/), 'Louvor');
    fireEvent.press(screen.getByText('Criar'));
    await waitFor(() => expect(m.houses.addMinistry).toHaveBeenCalledWith('h1', { name: 'Louvor' }));
  });

  // Story 197: só servo aparece como opção de líder e não há lista de filhos.
  it('lista só servos como líder — sem busca nem seleção de filhos', async () => {
    m.houses.listStaff.mockResolvedValue([{ id: 's1', name: 'Servo X' }]);
    rc(<CreateMinistryModal {...props} />);
    await waitFor(() => expect(screen.getByText('Servo X')).toBeTruthy());
    expect(screen.queryByPlaceholderText('Buscar filho...')).toBeNull();
    expect(screen.queryByText(/Filhos/)).toBeNull();
  });

  it('seleciona líder servo e cria com leaderType STAFF', async () => {
    m.houses.listStaff.mockResolvedValue([{ id: 's1', name: 'Servo X' }]);
    m.houses.addMinistry.mockResolvedValue({ id: 'min1' });
    m.ministries.update.mockResolvedValue({});
    const onSuccess = jest.fn();
    const onClose = jest.fn();
    rc(<CreateMinistryModal {...props} onSuccess={onSuccess} onClose={onClose} />);
    await waitFor(() => expect(screen.getByText('Servo X')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText(/Ex: Cozinha/), 'Cozinha');
    fireEvent.press(screen.getByText('Servo X'));
    fireEvent.press(screen.getByText('Criar'));
    await waitFor(() => expect(m.houses.addMinistry).toHaveBeenCalled());
    await waitFor(() =>
      expect(m.ministries.update).toHaveBeenCalledWith('min1', { leaderId: 's1', leaderType: 'STAFF' }),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('sem servo na casa mostra aviso', async () => {
    m.houses.listStaff.mockResolvedValue([]);
    rc(<CreateMinistryModal {...props} />);
    await waitFor(() => expect(screen.getByText('Nenhum servo disponível.')).toBeTruthy());
  });

  it('seleciona e desmarca "Sem líder"; Cancelar fecha o modal', async () => {
    m.houses.listStaff.mockResolvedValue([{ id: 's1', name: 'Servo X' }]);
    const onClose = jest.fn();
    rc(<CreateMinistryModal {...props} onClose={onClose} />);
    await waitFor(() => expect(screen.getByText('Servo X')).toBeTruthy());
    fireEvent.press(screen.getByText('Servo X'));
    fireEvent.press(screen.getByText('— Sem líder'));
    fireEvent.press(screen.getByText('Cancelar'));
    expect(onClose).toHaveBeenCalled();
  });

  it('Criar sem nome não muta', async () => {
    m.houses.listStaff.mockResolvedValue([]);
    rc(<CreateMinistryModal {...props} />);
    await waitFor(() => expect(screen.getByText('Novo ministério')).toBeTruthy());
    fireEvent.press(screen.getByText('Criar'));
    expect(m.houses.addMinistry).not.toHaveBeenCalled();
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

  // Story 197: só servo lidera — a lista vem de listStaff e nada mais.
  it('não oferece filho como líder', async () => {
    m.houses.listStaff.mockResolvedValue([{ id: 's1', name: 'Servo X' }]);
    rc(<LeaderPickerModal {...props} />);
    await waitFor(() => expect(screen.getByText('Servo X')).toBeTruthy());
    expect(m.houses.listResidents).toBeUndefined();
    expect(screen.queryByText('Filho')).toBeNull();
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
    members: [{ id: 's1', name: 'Servo Y', role: 'SERVO' }],
  };

  it('mostra líder, servos e botão de editar líder', async () => {
    m.houses.listStaff.mockResolvedValue([]);
    const onEditLeader = jest.fn();
    rc(<MinistryOverviewTab ministryId="min1" houseId="h1" ministry={ministry as never} onEditLeader={onEditLeader} />);
    await waitFor(() => expect(screen.getByText('Servo X')).toBeTruthy());
    expect(screen.getByText('Servo Y')).toBeTruthy();
    expect(screen.getByText('Servos (1)')).toBeTruthy();
    fireEvent.press(screen.getByText('Editar'));
    expect(onEditLeader).toHaveBeenCalled();
  });

  // Story 197: nem seção de filhos, nem filho na lista de membros.
  it('não tem seção de filhos', async () => {
    m.houses.listStaff.mockResolvedValue([]);
    rc(<MinistryOverviewTab ministryId="min1" houseId="h1" ministry={ministry as never} onEditLeader={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Servo X')).toBeTruthy());
    expect(screen.queryByText('Adicionar Filho')).toBeNull();
    expect(screen.queryByPlaceholderText('Buscar filho...')).toBeNull();
    expect(screen.queryByText('Filho')).toBeNull();
  });

  it('adiciona servo pela busca e remove servo da lista', async () => {
    m.houses.listStaff.mockResolvedValue([{ id: 's2', name: 'Servo Novo' }]);
    m.ministries.addStaff.mockResolvedValue({});
    m.ministries.removeStaff.mockResolvedValue({});
    rc(<MinistryOverviewTab ministryId="min1" houseId="h1" ministry={ministry as never} onEditLeader={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Servo X')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText('Buscar servo (staff)...'), 'novo');
    await waitFor(() => expect(screen.getByText('Servo Novo')).toBeTruthy());
    fireEvent.press(screen.getByText('Servo Novo'));
    await waitFor(() => expect(m.ministries.addStaff).toHaveBeenCalledWith('min1', 's2'));

    fireEvent.press(screen.getAllByText('icon:remove-circle-outline')[0]);
    await waitFor(() => expect(m.ministries.removeStaff).toHaveBeenCalledWith('min1', 's1'));
  });

  it('ministério sem servo mostra vazio', async () => {
    m.houses.listStaff.mockResolvedValue([]);
    rc(
      <MinistryOverviewTab
        ministryId="min1"
        houseId="h1"
        ministry={{ leaderName: null, members: [] } as never}
        onEditLeader={jest.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText('Nenhum servo adicionado.')).toBeTruthy());
  });
});

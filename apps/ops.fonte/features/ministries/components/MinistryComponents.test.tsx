import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/lib/test/utils';
import { queryKeys } from '@/lib/queryKeys';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

let mockOnline = true;
jest.mock('@/lib/offline/network', () => ({ useIsOnline: () => mockOnline }));

jest.mock('@/lib/api', () => ({
  api: {
    houses: { addMinistry: jest.fn(), listStaff: jest.fn() },
    residents: { listByHouse: jest.fn() },
    ministries: {
      update: jest.fn(),
      addStaff: jest.fn(),
      removeStaff: jest.fn(),
      addResident: jest.fn(),
      removeResident: jest.fn(),
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

const m = api as unknown as {
  houses: Record<string, jest.Mock>;
  residents: Record<string, jest.Mock>;
  ministries: Record<string, jest.Mock>;
};

function rc(ui: React.ReactElement) {
  return render(<QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>);
}

// Lista da casa como vem do store local: inclui quem já saiu (o bug do build antigo).
const HOUSE_RESIDENTS = [
  { id: 'r1', name: 'Filho Ativo', status: 'ACTIVE' },
  { id: 'r2', name: 'Filho Disciplina', status: 'DISCIPLINE' },
  { id: 'r3', name: 'Filho Saiu', status: 'DISCHARGED' },
  { id: 'r4', name: 'Filho Evadido', status: 'EVADED' },
  { id: 'r5', name: 'Filho Pre', status: 'PRE_ADMISSION' },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockOnline = true;
  m.residents.listByHouse.mockResolvedValue(HOUSE_RESIDENTS);
});

describe('MinistryCard', () => {
  // Story 205 (decisão 10): servos e filhos contados separados.
  it('mostra nome, líder e contagens de filhos e servos (plural)', () => {
    render(<MinistryCard ministry={{ id: 'min1', name: 'Cozinha', leaderName: 'Servo X', servoCount: 2, filhoCount: 3 } as never} />);
    expect(screen.getByText('Cozinha')).toBeTruthy();
    expect(screen.getByText('Líder: Servo X')).toBeTruthy();
    expect(screen.getByText('2 servos')).toBeTruthy();
    expect(screen.getByText('3 filhos')).toBeTruthy();
  });

  it('sem líder, contagens no singular; navega ao tocar', () => {
    render(<MinistryCard ministry={{ id: 'min1', name: 'Horta', leaderName: null, servoCount: 1, filhoCount: 1 } as never} />);
    expect(screen.getByText('Sem líder definido')).toBeTruthy();
    expect(screen.getByText('1 servo')).toBeTruthy();
    expect(screen.getByText('1 filho')).toBeTruthy();
    fireEvent.press(screen.getByText('Horta'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/ministries/min1');
  });

  it('cache antigo sem filhoCount mostra 0 filhos', () => {
    render(<MinistryCard ministry={{ id: 'min1', name: 'Horta', leaderName: null, servoCount: 0 } as never} />);
    expect(screen.getByText('0 filhos')).toBeTruthy();
  });

  // Story 207: badge do nível do líder servo.
  it('líder servo com nível mostra o badge', () => {
    render(
      <MinistryCard
        ministry={{ id: 'min1', name: 'Cozinha', leaderName: 'Servo X', leaderType: 'STAFF', leaderRank: 'CONSAGRADO', servoCount: 1, filhoCount: 0 } as never}
      />,
    );
    expect(screen.getByText('Consagrado')).toBeTruthy();
  });

  it('líder filho ou sem líder: sem badge de nível', () => {
    render(
      <MinistryCard
        ministry={{ id: 'min1', name: 'Horta', leaderName: 'Filho', leaderType: 'RESIDENT', leaderRank: 'CONSAGRADO', servoCount: 0, filhoCount: 1 } as never}
      />,
    );
    expect(screen.queryByTestId(/^servant-rank-/)).toBeNull();
    screen.unmount();
    render(<MinistryCard ministry={{ id: 'min2', name: 'X', leaderName: null, leaderType: null, leaderRank: null, servoCount: 0 } as never} />);
    expect(screen.queryByTestId(/^servant-rank-/)).toBeNull();
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

  // Story 205: filho em acolhimento volta como opção de líder; quem saiu não aparece.
  it('lista servos e só filhos em acolhimento como líder', async () => {
    m.houses.listStaff.mockResolvedValue([{ id: 's1', name: 'Servo X' }]);
    rc(<CreateMinistryModal {...props} />);
    await waitFor(() => expect(screen.getByText('Filho Ativo')).toBeTruthy());
    expect(screen.getByText('Servo X')).toBeTruthy();
    expect(screen.getByText('Filho Disciplina')).toBeTruthy();
    expect(screen.queryByText('Filho Saiu')).toBeNull();
    expect(screen.queryByText('Filho Evadido')).toBeNull();
    expect(screen.queryByText('Filho Pre')).toBeNull();
  });

  it('seleciona filho como líder e cria com leaderType RESIDENT', async () => {
    m.houses.listStaff.mockResolvedValue([]);
    m.houses.addMinistry.mockResolvedValue({ id: 'min1' });
    m.ministries.update.mockResolvedValue({});
    rc(<CreateMinistryModal {...props} />);
    await waitFor(() => expect(screen.getByText('Filho Ativo')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText(/Ex: Cozinha/), 'Horta');
    fireEvent.press(screen.getByText('Filho Ativo'));
    fireEvent.press(screen.getByText('Criar'));
    await waitFor(() =>
      expect(m.ministries.update).toHaveBeenCalledWith('min1', { leaderId: 'r1', leaderType: 'RESIDENT' }),
    );
  });

  it('sem sinal: aviso e Criar desabilitado', async () => {
    mockOnline = false;
    m.houses.listStaff.mockResolvedValue([]);
    rc(<CreateMinistryModal {...props} />);
    expect(screen.getByText('Precisa de conexão para criar um ministério.')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText(/Ex: Cozinha/), 'Horta');
    fireEvent.press(screen.getByText('Criar'));
    expect(m.houses.addMinistry).not.toHaveBeenCalled();
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

  it('sem servo nem filho elegível na casa mostra aviso', async () => {
    m.houses.listStaff.mockResolvedValue([]);
    m.residents.listByHouse.mockResolvedValue([{ id: 'r3', name: 'Filho Saiu', status: 'DISCHARGED' }]);
    rc(<CreateMinistryModal {...props} />);
    await waitFor(() => expect(screen.getByText('Nenhuma pessoa disponível.')).toBeTruthy());
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

  // Story 205: filho em acolhimento volta a liderar; quem saiu não aparece.
  it('oferece só filhos em acolhimento como líder e grava RESIDENT', async () => {
    m.houses.listStaff.mockResolvedValue([{ id: 's1', name: 'Servo X' }]);
    m.ministries.update.mockResolvedValue({});
    rc(<LeaderPickerModal {...props} />);
    await waitFor(() => expect(screen.getByText('Filho Ativo')).toBeTruthy());
    expect(screen.queryByText('Filho Saiu')).toBeNull();
    fireEvent.press(screen.getByText('Filho Disciplina'));
    await waitFor(() =>
      expect(m.ministries.update).toHaveBeenCalledWith('min1', { leaderId: 'r2', leaderType: 'RESIDENT' }),
    );
  });

  it('marca o líder atual (filho)', async () => {
    m.houses.listStaff.mockResolvedValue([]);
    rc(<LeaderPickerModal {...props} currentLeaderId="r1" currentLeaderType="RESIDENT" />);
    await waitFor(() => expect(screen.getByText('Filho Ativo')).toBeTruthy());
    expect(screen.getByLabelText('Líder Filho Ativo').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText('Líder Filho Disciplina').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('sem sinal: aviso e opções desabilitadas', async () => {
    mockOnline = false;
    m.houses.listStaff.mockResolvedValue([{ id: 's1', name: 'Servo X' }]);
    rc(<LeaderPickerModal {...props} />);
    expect(screen.getByText('Precisa de conexão para trocar o líder.')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Servo X')).toBeTruthy());
    fireEvent.press(screen.getByText('Servo X'));
    expect(m.ministries.update).not.toHaveBeenCalled();
  });

  // Story 204: seletor e lista *Servos* compartilham `staff.byHouse` — com o
  // cache já populado (ex.: aquecimento offline), o seletor lista sem rede.
  it('lista os servos a partir da key compartilhada staff.byHouse', async () => {
    const client = createTestQueryClient();
    client.setDefaultOptions({ queries: { retry: false, staleTime: Infinity } });
    client.setQueryData(queryKeys.staff.byHouse('h1'), [{ id: 's9', name: 'Servo do Cache' }]);
    render(
      <QueryClientProvider client={client}>
        <LeaderPickerModal {...props} />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Servo do Cache')).toBeTruthy();
    expect(m.houses.listStaff).not.toHaveBeenCalled();
  });

  // Story 207: cada servo listado com o badge do nível; filho sem badge.
  it('servos listados com o badge do nível; filhos e servo sem nível sem badge', async () => {
    m.houses.listStaff.mockResolvedValue([
      { id: 's1', name: 'Servo X', rank: 'ASPIRANTE' },
      { id: 's2', name: 'Coord Y', rank: null },
    ]);
    rc(<LeaderPickerModal {...props} />);
    await waitFor(() => expect(screen.getByText('Servo X')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('Filho Ativo')).toBeTruthy());
    expect(screen.getByText('Aspirante')).toBeTruthy();
    expect(screen.getAllByTestId(/^servant-rank-/)).toHaveLength(1);
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

  // ── Story 205: seção de filhos ─────────────────────────────────────────
  const withResident = {
    leaderName: 'Servo X',
    members: [
      { id: 'r1', name: 'Filho Ativo', role: 'FILHO' },
      { id: 's1', name: 'Servo Y', role: 'SERVO' },
    ],
  };

  it('"Adicionar filho" lista só filhos em acolhimento da casa (filho com alta não aparece)', async () => {
    m.houses.listStaff.mockResolvedValue([]);
    rc(<MinistryOverviewTab ministryId="min1" houseId="h1" ministry={ministry as never} onEditLeader={jest.fn()} />);
    fireEvent.changeText(screen.getByPlaceholderText('Buscar filho em acolhimento...'), 'filho');
    await waitFor(() => expect(screen.getByText('Filho Ativo')).toBeTruthy());
    expect(screen.getByText('Filho Disciplina')).toBeTruthy();
    expect(screen.queryByText('Filho Saiu')).toBeNull();
    expect(screen.queryByText('Filho Evadido')).toBeNull();
    expect(screen.queryByText('Filho Pre')).toBeNull();
    expect(m.residents.listByHouse).toHaveBeenCalledWith('h1');
  });

  it('busca que não casa mostra aviso', async () => {
    m.houses.listStaff.mockResolvedValue([]);
    rc(<MinistryOverviewTab ministryId="min1" houseId="h1" ministry={ministry as never} onEditLeader={jest.fn()} />);
    await waitFor(() => expect(m.residents.listByHouse).toHaveBeenCalled());
    fireEvent.changeText(screen.getByPlaceholderText('Buscar filho em acolhimento...'), 'zzz');
    expect(screen.getByText('Nenhum filho em acolhimento disponível.')).toBeTruthy();
  });

  it('adiciona filho pela busca e remove filho da lista', async () => {
    m.houses.listStaff.mockResolvedValue([]);
    m.ministries.addResident.mockResolvedValue({});
    m.ministries.removeResident.mockResolvedValue({});
    rc(<MinistryOverviewTab ministryId="min1" houseId="h1" ministry={withResident as never} onEditLeader={jest.fn()} />);
    expect(screen.getByText('Filhos (1)')).toBeTruthy();
    expect(screen.getByText('Servos (1)')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('Buscar filho em acolhimento...'), 'filho');
    // Quem já é membro não volta na busca.
    await waitFor(() => expect(screen.getByLabelText('Adicionar Filho Disciplina')).toBeTruthy());
    expect(screen.queryByLabelText('Adicionar Filho Ativo')).toBeNull();
    fireEvent.press(screen.getByLabelText('Adicionar Filho Disciplina'));
    await waitFor(() => expect(m.ministries.addResident).toHaveBeenCalledWith('min1', 'r2'));

    fireEvent.press(screen.getByLabelText('Remover Filho Ativo'));
    await waitFor(() => expect(m.ministries.removeResident).toHaveBeenCalledWith('min1', 'r1'));
  });

  it('sem sinal: aviso, busca travada e nada é gravado', async () => {
    mockOnline = false;
    m.houses.listStaff.mockResolvedValue([{ id: 's2', name: 'Servo Novo' }]);
    const onEditLeader = jest.fn();
    rc(<MinistryOverviewTab ministryId="min1" houseId="h1" ministry={withResident as never} onEditLeader={onEditLeader} />);
    expect(screen.getByText('Precisa de conexão para alterar o ministério.')).toBeTruthy();
    expect(screen.getByPlaceholderText('Buscar filho em acolhimento...').props.editable).toBe(false);
    expect(screen.getByPlaceholderText('Buscar servo (staff)...').props.editable).toBe(false);
    fireEvent.press(screen.getByLabelText('Remover Filho Ativo'));
    fireEvent.press(screen.getByLabelText('Editar líder'));
    fireEvent.press(screen.getAllByText('icon:remove-circle-outline')[1]);
    expect(m.ministries.removeResident).not.toHaveBeenCalled();
    expect(m.ministries.removeStaff).not.toHaveBeenCalled();
    expect(onEditLeader).not.toHaveBeenCalled();
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

  // Story 207: nível do líder servo ao lado do nome.
  it('líder servo com nível mostra o badge', async () => {
    m.houses.listStaff.mockResolvedValue([]);
    rc(
      <MinistryOverviewTab
        ministryId="min1"
        houseId="h1"
        ministry={{ leaderName: 'Servo X', leaderType: 'STAFF', leaderRank: 'ALIANCADO', members: [] } as never}
        onEditLeader={jest.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText('Aliançado')).toBeTruthy());
  });

  it('líder filho: sem badge de nível', async () => {
    m.houses.listStaff.mockResolvedValue([]);
    rc(
      <MinistryOverviewTab
        ministryId="min1"
        houseId="h1"
        ministry={{ leaderName: 'Filho', leaderType: 'RESIDENT', leaderRank: null, members: [] } as never}
        onEditLeader={jest.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText('Filho')).toBeTruthy());
    expect(screen.queryByTestId(/^servant-rank-/)).toBeNull();
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

import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { FlatList } from 'react-native';
import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';

const mockUseActivities = jest.fn();
const mockMutate = jest.fn();
const mockPush = jest.fn();

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
let mockParams: Record<string, string | undefined> = {};
let mockRole = 'SERVANT';
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ staff: { houseId: 'h1', userId: 'u1', user: { role: mockRole } } }),
}));
// O seletor tem teste próprio; aqui só importa com que alvo/modo ele abre.
jest.mock('@/features/activities/components/SelectResponsibleModal', () => {
  const { Text } = require('react-native');
  return {
    SelectResponsibleModal: ({
      target,
      onClose,
    }: {
      target: { activity: { id: string }; mode: string } | null;
      onClose: () => void;
    }) =>
      target ? (
        <Text onPress={onClose}>{`modal:${target.mode}:${target.activity.id}`}</Text>
      ) : null,
  };
});
jest.mock('@/lib/offline/network', () => ({ useIsOnline: () => true }));
jest.mock('@/features/activities/hooks/useActivities', () => ({
  useActivities: (...a: unknown[]) => mockUseActivities(...a),
  useChangeActivityStatus: () => ({ mutate: mockMutate, isPending: false }),
}));
jest.mock('@/features/activities/components/QuickAddCard', () => {
  const { Text } = require('react-native');
  return { QuickAddCard: ({ status }: { status: string }) => <Text>{`quick-add:${status}`}</Text> };
});

import { ActivitiesPage } from './ActivitiesPage';

function activity(id: string, status: ActivityStatus, title = id): Activity {
  return {
    id,
    title,
    description: null,
    status,
    houseId: 'h1',
    house: null,
    responsibleStaffId: null,
    responsible: null,
    createdByUserId: 'u1',
    createdBy: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function mockQuery(query: Record<string, unknown>) {
  mockUseActivities.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    ...query,
  });
}

function tab(status: ActivityStatus) {
  return screen.getByTestId(`activity-tab-${status}`);
}

function count(status: ActivityStatus) {
  return screen.getByTestId(`activity-tab-count-${status}`).props.children;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockRole = 'SERVANT';
  jest.spyOn(FlatList.prototype, 'scrollToOffset').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('ActivitiesPage (story 208)', () => {
  it('loading usa o LoadingState', () => {
    mockQuery({ isLoading: true });
    render(<ActivitiesPage />);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(mockUseActivities).toHaveBeenCalledWith('h1');
  });

  it('erro usa o ErrorState com tentar de novo', () => {
    const refetch = jest.fn();
    mockQuery({ error: new Error('x'), refetch });
    render(<ActivitiesPage />);
    expect(screen.getByText('Erro ao carregar atividades.')).toBeTruthy();
    fireEvent.press(screen.getByText('Tentar novamente'));
    expect(refetch).toHaveBeenCalled();
  });

  it('colunas vazias aparecem como aba e tudo vazio abre em Rascunhos', () => {
    mockQuery({ data: [] });
    render(<ActivitiesPage />);
    expect(screen.getAllByRole('tab')).toHaveLength(6);
    expect(tab(ActivityStatus.DRAFT)).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
    expect(within(screen.getByTestId('activity-column-DRAFT')).getByText('quick-add:DRAFT')).toBeTruthy();
    expect(screen.getAllByText('Nenhuma atividade').length).toBe(6);
  });

  it('abre na primeira coluna com itens e trocar de aba mostra os cards daquele status', () => {
    mockQuery({
      data: [
        activity('a1', ActivityStatus.REQUESTED, 'Consertar portão'),
        activity('a2', ActivityStatus.DONE, 'Pintar muro'),
      ],
    });
    render(<ActivitiesPage />);

    expect(tab(ActivityStatus.REQUESTED)).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );

    fireEvent.press(screen.getByText('Concluídas'));
    expect(tab(ActivityStatus.DONE)).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
    const done = within(screen.getByTestId('activity-column-DONE'));
    expect(done.getByText('Pintar muro')).toBeTruthy();
    expect(done.queryByText('Consertar portão')).toBeNull();
  });

  it('mudar o status de um card mantém a aba ativa e atualiza os contadores', () => {
    const item = activity('a1', ActivityStatus.REQUESTED, 'Consertar portão');
    mockQuery({ data: [item] });
    const { rerender } = render(<ActivitiesPage />);

    fireEvent.press(screen.getByText('Devolver para rascunho'));
    expect(mockMutate).toHaveBeenCalledWith({
      id: 'a1',
      data: { status: ActivityStatus.DRAFT },
    });

    // Atualização otimista: o card mudou de coluna no cache.
    mockQuery({ data: [{ ...item, status: ActivityStatus.DRAFT }] });
    rerender(<ActivitiesPage />);

    expect(tab(ActivityStatus.REQUESTED)).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
    expect(count(ActivityStatus.REQUESTED)).toBe(0);
    expect(count(ActivityStatus.DRAFT)).toBe(1);
  });

  it('tocar no card abre o detalhe', () => {
    mockQuery({ data: [activity('a1', ActivityStatus.TODO, 'Varrer pátio')] });
    render(<ActivitiesPage />);
    fireEvent.press(screen.getByText('Varrer pátio'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/activities/a1');
  });

  it('FAB em Rascunhos leva ?status=DRAFT (story 224)', () => {
    mockQuery({ data: [] });
    render(<ActivitiesPage />);
    fireEvent.press(screen.getByLabelText('Nova atividade'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(app)/activities/new',
      params: { status: ActivityStatus.DRAFT },
    });
  });

  it('coordenador: FAB na aba Solicitações leva ?status=REQUESTED (story 224)', () => {
    mockRole = 'COORDINATOR';
    mockParams = { tab: 'REQUESTED' };
    mockQuery({ data: [] });
    render(<ActivitiesPage />);
    fireEvent.press(screen.getByLabelText('Nova atividade'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(app)/activities/new',
      params: { status: ActivityStatus.REQUESTED },
    });
  });

  it('servo: FAB numa aba onde não cria vai sem ?status= (story 224)', () => {
    mockParams = { tab: 'TODO' };
    mockQuery({ data: [] });
    render(<ActivitiesPage />);
    fireEvent.press(screen.getByLabelText('Nova atividade'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/activities/new');
  });

  it('coordenador: quick-add aparece em A fazer (story 224)', () => {
    mockRole = 'COORDINATOR';
    mockQuery({ data: [] });
    render(<ActivitiesPage />);
    expect(
      within(screen.getByTestId('activity-column-TODO')).getByText('quick-add:TODO'),
    ).toBeTruthy();
  });

  it('?tab=DRAFT abre em Rascunhos mesmo com itens em colunas anteriores (story 220)', () => {
    mockParams = { tab: 'DRAFT' };
    mockQuery({
      data: [
        activity('a1', ActivityStatus.REQUESTED, 'Pedido'),
        activity('a2', ActivityStatus.DRAFT, 'Rascunho novo'),
      ],
    });
    render(<ActivitiesPage />);
    expect(tab(ActivityStatus.DRAFT)).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
  });

  it('?tab=DRAFT vale mesmo se a lista ainda estava carregando (story 220)', () => {
    mockParams = { tab: 'DRAFT' };
    mockQuery({ isLoading: true });
    const { rerender } = render(<ActivitiesPage />);
    mockQuery({ data: [activity('a1', ActivityStatus.TODO, 'Outro')] });
    rerender(<ActivitiesPage />);
    expect(tab(ActivityStatus.DRAFT)).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
  });

  it('?tab inválido mantém a regra de initialActivityTab (story 220)', () => {
    mockParams = { tab: 'QUALQUER' };
    mockQuery({ data: [activity('a1', ActivityStatus.TODO, 'Outro')] });
    render(<ActivitiesPage />);
    expect(tab(ActivityStatus.TODO)).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
  });

  it('coordenador aprova com responsável já definido direto, sem modal (story 220)', () => {
    mockRole = 'COORDINATOR';
    mockQuery({
      data: [
        {
          ...activity('a1', ActivityStatus.REQUESTED, 'Pedido'),
          createdByUserId: 'outro',
          responsibleStaffId: 's1',
          responsible: { id: 's1', name: 'Ana', userId: 'u-s1' },
        },
      ],
    });
    render(<ActivitiesPage />);
    fireEvent.press(screen.getByText('Aprovar solicitação'));
    expect(mockMutate).toHaveBeenCalledWith({ id: 'a1', data: { status: ActivityStatus.TODO } });
    expect(screen.queryByText(/modal:/)).toBeNull();
  });

  it('coordenador aprova sem responsável: abre o seletor em modo aprovar (story 220)', () => {
    mockRole = 'COORDINATOR';
    mockQuery({
      data: [{ ...activity('a1', ActivityStatus.REQUESTED, 'Pedido'), createdByUserId: 'outro' }],
    });
    render(<ActivitiesPage />);
    fireEvent.press(screen.getByText('Aprovar solicitação'));
    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByText('modal:approve:a1')).toBeTruthy();

    fireEvent.press(screen.getByText('modal:approve:a1'));
    expect(screen.queryByText(/modal:/)).toBeNull();
  });

  it('coordenador toca no responsável e abre o seletor em modo trocar (story 220)', () => {
    mockRole = 'COORDINATOR';
    mockQuery({ data: [activity('a1', ActivityStatus.TODO, 'Varrer')] });
    render(<ActivitiesPage />);
    fireEvent.press(screen.getByLabelText('Definir responsável'));
    expect(screen.getByText('modal:change:a1')).toBeTruthy();
  });

  it('puxar para atualizar refaz a query', async () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    mockQuery({ data: [], refetch });
    render(<ActivitiesPage />);
    const column = screen.UNSAFE_getAllByType(FlatList).find((l) => !l.props.horizontal)!;
    await act(async () => {
      await column.props.onRefresh();
    });
    expect(refetch).toHaveBeenCalled();
  });
});

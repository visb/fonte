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
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ staff: { houseId: 'h1', userId: 'u1', user: { role: 'SERVANT' } } }),
}));
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

  it('FAB navega para /activities/new', () => {
    mockQuery({ data: [] });
    render(<ActivitiesPage />);
    fireEvent.press(screen.getByLabelText('Nova atividade'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/activities/new');
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

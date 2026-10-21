import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { ActivityEventType, ActivityStatus } from '@fonte/types';
import type { ActivityEvent } from '@fonte/api-client';

const mockUseActivityEvents = jest.fn();
const mockUseHouseStaff = jest.fn();

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('@/features/activities/hooks/useActivities', () => ({
  useActivityEvents: (...a: unknown[]) => mockUseActivityEvents(...a),
}));
jest.mock('@/features/staff/hooks/useHouseStaff', () => ({
  useHouseStaff: (...a: unknown[]) => mockUseHouseStaff(...a),
}));

import { ActivityHistory } from './ActivityHistory';

let seq = 0;
function event(type: ActivityEventType, metadata: Record<string, unknown> | null = null): ActivityEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    activityId: 'a1',
    type,
    actor: { id: 'st-c', name: 'Coord Carla', userId: 'u-c' },
    actorUserId: 'u-c',
    metadata,
    createdAt: '2026-03-10T12:00:00.000Z',
  };
}

function eventsQuery(over: Record<string, unknown>) {
  mockUseActivityEvents.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    ...over,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseHouseStaff.mockReturnValue({
    data: [
      { id: 's1', name: 'Ana' },
      { id: 's2', name: 'Bruno' },
    ],
  });
});

function textOf(id: string) {
  return within(screen.getByTestId(`activity-event-${id}`));
}

describe('ActivityHistory (story 220)', () => {
  it('busca a trilha da atividade e os servos da casa', () => {
    eventsQuery({ data: [] });
    render(<ActivityHistory activityId="a1" houseId="h1" />);
    expect(mockUseActivityEvents).toHaveBeenCalledWith('a1');
    expect(mockUseHouseStaff).toHaveBeenCalledWith('h1');
  });

  it('renderiza cada tipo de evento com ator', () => {
    const list = [
      event(ActivityEventType.CREATED),
      event(ActivityEventType.STATUS_CHANGED, {
        from: ActivityStatus.REQUESTED,
        to: ActivityStatus.TODO,
      }),
      event(ActivityEventType.STATUS_CHANGED, null),
      event(ActivityEventType.TITLE_CHANGED, { from: 'a', to: 'b' }),
      event(ActivityEventType.DESCRIPTION_CHANGED),
      event(ActivityEventType.COMMENTED, { commentId: 'c1' }),
      event(ActivityEventType.DELETED),
    ];
    eventsQuery({ data: list });
    render(<ActivityHistory activityId="a1" houseId="h1" />);

    expect(screen.getAllByText('Coord Carla')).toHaveLength(list.length);
    expect(textOf(list[0].id).getByText(/criou a atividade/)).toBeTruthy();
    expect(textOf(list[1].id).getByText(/moveu de Solicitações para A fazer/)).toBeTruthy();
    expect(textOf(list[2].id).getByText(/moveu$/)).toBeTruthy();
    expect(textOf(list[3].id).getByText(/alterou o título/)).toBeTruthy();
    expect(textOf(list[4].id).getByText(/alterou a descrição/)).toBeTruthy();
    expect(textOf(list[5].id).getByText(/comentou/)).toBeTruthy();
    expect(textOf(list[6].id).getByText(/excluiu a atividade/)).toBeTruthy();
  });

  it('RESPONSIBLE_CHANGED: atribuição, troca, remoção, fallback de nome e sem metadado', () => {
    const list = [
      event(ActivityEventType.RESPONSIBLE_CHANGED, { from: null, to: 's1' }),
      event(ActivityEventType.RESPONSIBLE_CHANGED, { from: 's1', to: 's2' }),
      event(ActivityEventType.RESPONSIBLE_CHANGED, { from: 's2', to: 'gone' }),
      event(ActivityEventType.RESPONSIBLE_CHANGED, { from: 's1', to: null }),
      event(ActivityEventType.RESPONSIBLE_CHANGED, null),
    ];
    eventsQuery({ data: list });
    render(<ActivityHistory activityId="a1" houseId="h1" />);

    expect(textOf(list[0].id).getByText(/atribuiu a Ana/)).toBeTruthy();
    expect(textOf(list[1].id).getByText(/trocou o responsável de Ana para Bruno/)).toBeTruthy();
    expect(textOf(list[2].id).getByText(/de Bruno para servo removido/)).toBeTruthy();
    expect(textOf(list[3].id).getByText(/removeu o responsável Ana/)).toBeTruthy();
    expect(textOf(list[4].id).getByText(/alterou o responsável/)).toBeTruthy();
  });

  it('ator desconhecido vira "Alguém"', () => {
    const e = { ...event(ActivityEventType.CREATED), actor: null };
    eventsQuery({ data: [e] });
    render(<ActivityHistory activityId="a1" houseId="h1" />);
    expect(screen.getByText('Alguém')).toBeTruthy();
  });

  it('sem lista de servos (offline sem cache) ainda renderiza com fallback', () => {
    mockUseHouseStaff.mockReturnValue({ data: undefined });
    const e = event(ActivityEventType.RESPONSIBLE_CHANGED, { from: null, to: 's1' });
    eventsQuery({ data: [e] });
    render(<ActivityHistory activityId="a1" houseId={null} />);
    expect(textOf(e.id).getByText(/atribuiu a servo removido/)).toBeTruthy();
  });

  it('loading não mostra eventos', () => {
    eventsQuery({ isLoading: true });
    render(<ActivityHistory activityId="a1" houseId="h1" />);
    expect(screen.queryByTestId('activity-history')).toBeNull();
    expect(screen.queryByText('Nenhum registro no histórico.')).toBeNull();
  });

  it('erro usa ErrorState com tentar de novo', () => {
    const refetch = jest.fn();
    eventsQuery({ error: new Error('x'), refetch });
    render(<ActivityHistory activityId="a1" houseId="h1" />);
    expect(screen.getByText('Erro ao carregar o histórico.')).toBeTruthy();
    fireEvent.press(screen.getByText('Tentar novamente'));
    expect(refetch).toHaveBeenCalled();
  });

  it('vazio usa EmptyState', () => {
    eventsQuery({ data: [] });
    render(<ActivityHistory activityId="a1" houseId="h1" />);
    expect(screen.getByText('Nenhum registro no histórico.')).toBeTruthy();
  });

  it('data inválida aparece crua', () => {
    const e = { ...event(ActivityEventType.CREATED), createdAt: 'ontem' };
    eventsQuery({ data: [e] });
    render(<ActivityHistory activityId="a1" houseId="h1" />);
    expect(screen.getByText('ontem')).toBeTruthy();
  });
});

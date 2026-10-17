import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { FlatList } from 'react-native';
import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
// O quick-add tem teste próprio (ActivityCommentsAndQuickAdd.test.tsx); aqui só
// importa onde ele aparece.
jest.mock('./QuickAddCard', () => {
  const { Text } = require('react-native');
  return {
    QuickAddCard: ({ status, houseId }: { status: string; houseId?: string }) => (
      <Text>{`quick-add:${status}:${houseId}`}</Text>
    ),
  };
});

import { ActivityColumn } from './ActivityColumn';

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

function setup(status: ActivityStatus, data: Activity[], overrides = {}) {
  const props = {
    column: { status, title: 'Coluna', data },
    width: 360,
    role: 'SERVANT',
    houseId: 'h1',
    currentUserId: 'u1',
    onChangeStatus: jest.fn(),
    onPressActivity: jest.fn(),
    refreshing: false,
    onRefresh: jest.fn(),
    ...overrides,
  };
  render(<ActivityColumn {...props} />);
  return props;
}

describe('ActivityColumn (story 208)', () => {
  it('lista os cards da coluna e repassa as ações', () => {
    const items = [
      activity('a1', ActivityStatus.DRAFT, 'Trocar lâmpada'),
      activity('a2', ActivityStatus.DRAFT, 'Lavar quintal'),
    ];
    const props = setup(ActivityStatus.DRAFT, items);

    expect(screen.getByText('Trocar lâmpada')).toBeTruthy();
    expect(screen.getByText('Lavar quintal')).toBeTruthy();
    expect(screen.queryByText('Nenhuma atividade')).toBeNull();

    fireEvent.press(screen.getByText('Trocar lâmpada'));
    expect(props.onPressActivity).toHaveBeenCalledWith(items[0]);

    fireEvent.press(screen.getAllByText('Enviar')[0]);
    expect(props.onChangeStatus).toHaveBeenCalledWith(items[0], ActivityStatus.REQUESTED);
  });

  it('coluna vazia mostra o EmptyState', () => {
    setup(ActivityStatus.TODO, []);
    expect(screen.getByText('Nenhuma atividade')).toBeTruthy();
  });

  it('quick-add só na coluna DRAFT', () => {
    setup(ActivityStatus.DRAFT, []);
    expect(screen.getByText('quick-add:DRAFT:h1')).toBeTruthy();
  });

  it('sem quick-add fora de DRAFT', () => {
    setup(ActivityStatus.REQUESTED, [activity('a1', ActivityStatus.REQUESTED)]);
    expect(screen.queryByText(/quick-add/)).toBeNull();
  });

  it('puxar para atualizar chama onRefresh', async () => {
    const props = setup(ActivityStatus.DONE, []);
    const list = screen.UNSAFE_getByType(FlatList);
    await act(async () => {
      list.props.onRefresh();
    });
    expect(props.onRefresh).toHaveBeenCalled();
  });
});

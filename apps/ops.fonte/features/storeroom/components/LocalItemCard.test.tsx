/**
 * Item de estoque cadastrado sem sinal (story 171, decisão 2): aparece na lista
 * marcado como pendente e **não** é editável até subir.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SupplyRoomCategory } from '@fonte/types';
import type { StoreroomItem, SupplyRoomItem } from '@fonte/api-client';
import { createLocalId } from '@/lib/offline/localIds';
import { StoreroomItemCard } from './StoreroomItemCard';
import { SupplyRoomItemCard } from '@/features/supply-room/components/SupplyRoomItemCard';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

function storeroomItem(id: string): StoreroomItem {
  return {
    id,
    name: 'Arroz',
    unit: 'kg',
    houseId: 'h1',
    currentQuantity: 0,
    weeklyAverageUsage: null,
    weeklyAverageCalculatedAt: null,
    weeklyAverageWindowStart: null,
    weeklyAverageWindowEnd: null,
  };
}

function supplyItem(id: string): SupplyRoomItem {
  return {
    id,
    name: 'Sabão',
    unit: 'un',
    category: SupplyRoomCategory.CLEANING,
    houseId: 'h1',
    currentQuantity: 0,
  };
}

describe('StoreroomItemCard', () => {
  it('item local fica pendente e não abre o histórico', () => {
    const onPress = jest.fn();
    render(<StoreroomItemCard item={storeroomItem(createLocalId())} onPress={onPress} />);

    fireEvent.press(screen.getByText('Arroz'));

    expect(screen.getByTestId('pending-sync-badge')).toBeTruthy();
    expect(onPress).not.toHaveBeenCalled();
    // Estoque zerado do item novo não é "estoque baixo".
    expect(screen.queryByText('Baixo')).toBeNull();
  });

  it('item do servidor abre normalmente', () => {
    const onPress = jest.fn();
    render(<StoreroomItemCard item={storeroomItem('item-real')} onPress={onPress} />);

    fireEvent.press(screen.getByText('Arroz'));

    expect(onPress).toHaveBeenCalled();
    expect(screen.queryByTestId('pending-sync-badge')).toBeNull();
    expect(screen.getByText('Baixo')).toBeTruthy();
  });

  it('movimentação na fila também marca o item (story 169)', () => {
    render(
      <StoreroomItemCard item={storeroomItem('item-real')} onPress={jest.fn()} isPendingSync />,
    );

    expect(screen.getByTestId('pending-sync-badge')).toBeTruthy();
  });
});

describe('SupplyRoomItemCard', () => {
  it('item local fica pendente e não abre o histórico', () => {
    const onPress = jest.fn();
    render(<SupplyRoomItemCard item={supplyItem(createLocalId())} onPress={onPress} />);

    fireEvent.press(screen.getByText('Sabão'));

    expect(screen.getByTestId('pending-sync-badge')).toBeTruthy();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('item do servidor abre normalmente', () => {
    const onPress = jest.fn();
    render(<SupplyRoomItemCard item={supplyItem('item-real')} onPress={onPress} />);

    fireEvent.press(screen.getByText('Sabão'));

    expect(onPress).toHaveBeenCalled();
    expect(screen.queryByTestId('pending-sync-badge')).toBeNull();
  });
});

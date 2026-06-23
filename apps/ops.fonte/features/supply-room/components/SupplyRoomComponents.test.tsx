import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MovementType, SupplyRoomCategory } from '@fonte/types';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/lib/test/utils';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('@/components/WheelDatePickerModal', () => {
  const { Text, TouchableOpacity } = require('react-native');
  return {
    WheelDatePickerModal: ({ visible, onConfirm }: { visible: boolean; onConfirm: (d: Date) => void }) =>
      visible ? (
        <TouchableOpacity onPress={() => onConfirm(new Date('2026-02-15T00:00:00'))}>
          <Text>confirm-date</Text>
        </TouchableOpacity>
      ) : null,
  };
});
jest.mock('@/lib/api', () => ({
  api: { supplyRoom: { listMovements: jest.fn() } },
  resolveAssetUrl: (u: string) => u,
}));

import { api } from '@/lib/api';
import { Alert } from 'react-native';
import { CategorySelector } from './CategorySelector';
import { SupplyRoomItemCard } from './SupplyRoomItemCard';
import { NewItemForm } from './NewItemForm';
import { ItemSearchInput } from './ItemSearchInput';
import { DateField } from './DateField';
import { MovementTypeSelector } from './MovementTypeSelector';
import { MovementHistoryRow } from './MovementHistoryRow';
import { ItemDetailsModal } from './ItemDetailsModal';

const m = api as unknown as { supplyRoom: Record<string, jest.Mock> };

function renderWithClient(ui: React.ReactElement) {
  return render(<QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>);
}

function makeItem(overrides = {}) {
  return {
    id: 'i1',
    name: 'Detergente',
    unit: 'L',
    currentQuantity: 10,
    category: SupplyRoomCategory.CLEANING,
    ...overrides,
  } as never;
}

beforeEach(() => jest.clearAllMocks());

describe('CategorySelector', () => {
  it('renderiza as categorias e seleciona', () => {
    const onChange = jest.fn();
    render(<CategorySelector value={null} onChange={onChange} />);
    expect(screen.getByText('Limpeza')).toBeTruthy();
    expect(screen.getByText('EPI')).toBeTruthy();
    fireEvent.press(screen.getByText('Higiene'));
    expect(onChange).toHaveBeenCalledWith(SupplyRoomCategory.HYGIENE);
  });

  it('mostra erro quando informado', () => {
    render(<CategorySelector value={null} onChange={jest.fn()} error="obrigatório" />);
    expect(screen.getByText('obrigatório')).toBeTruthy();
  });
});

describe('SupplyRoomItemCard', () => {
  it('mostra estoque + badge da categoria; Baixo quando ≤ 5', () => {
    render(<SupplyRoomItemCard item={makeItem({ currentQuantity: 2 })} onPress={jest.fn()} />);
    expect(screen.getByText('Detergente')).toBeTruthy();
    expect(screen.getByText(/Estoque: 2 L/)).toBeTruthy();
    expect(screen.getByText('Baixo')).toBeTruthy();
  });

  it('estoque alto não mostra Baixo e dispara onPress', () => {
    const onPress = jest.fn();
    render(<SupplyRoomItemCard item={makeItem({ currentQuantity: 50 })} onPress={onPress} />);
    expect(screen.queryByText('Baixo')).toBeNull();
    fireEvent.press(screen.getByText('Detergente'));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('NewItemForm (supply-room exige categoria)', () => {
  beforeEach(() => jest.spyOn(Alert, 'alert').mockImplementation(() => undefined));

  it('sem unidade alerta', () => {
    const onConfirm = jest.fn();
    render(<NewItemForm name="Álcool" onConfirm={onConfirm} onCancel={jest.fn()} isPending={false} />);
    fireEvent.press(screen.getByText('Cadastrar'));
    expect(Alert.alert).toHaveBeenCalledWith('Atenção', 'Informe a unidade de medida.');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('com unidade mas sem categoria alerta', () => {
    const onConfirm = jest.fn();
    render(<NewItemForm name="Álcool" onConfirm={onConfirm} onCancel={jest.fn()} isPending={false} />);
    fireEvent.changeText(screen.getByPlaceholderText(/Ex: kg/), 'L');
    fireEvent.press(screen.getByText('Cadastrar'));
    expect(Alert.alert).toHaveBeenCalledWith('Atenção', 'Selecione uma categoria.');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('unidade + categoria confirma com ambos', () => {
    const onConfirm = jest.fn();
    render(<NewItemForm name="Álcool" onConfirm={onConfirm} onCancel={jest.fn()} isPending={false} />);
    fireEvent.changeText(screen.getByPlaceholderText(/Ex: kg/), 'L');
    fireEvent.press(screen.getByText('Higiene'));
    fireEvent.press(screen.getByText('Cadastrar'));
    expect(onConfirm).toHaveBeenCalledWith('L', SupplyRoomCategory.HYGIENE);
  });
});

describe('ItemSearchInput', () => {
  it('filtra e seleciona item', () => {
    const onSelect = jest.fn();
    render(
      <ItemSearchInput
        value="det"
        selectedItemId=""
        items={[makeItem(), makeItem({ id: 'i2', name: 'Sabão' })]}
        onChangeText={jest.fn()}
        onSelect={onSelect}
        onConfirmNewItem={jest.fn()}
        isCreatingItem={false}
      />,
    );
    fireEvent(screen.getByPlaceholderText('Buscar item...'), 'focus');
    fireEvent.press(screen.getByText('Detergente'));
    expect(onSelect).toHaveBeenCalled();
  });
});

describe('DateField / MovementTypeSelector / MovementHistoryRow', () => {
  it('DateField propaga data confirmada', () => {
    const onChange = jest.fn();
    render(<DateField value={new Date('2026-01-01T00:00:00')} onChange={onChange} />);
    fireEvent.press(screen.getByText('01/01/2026'));
    fireEvent.press(screen.getByText('confirm-date'));
    expect(onChange).toHaveBeenCalledWith(expect.any(Date), '2026-02-15');
  });

  it('MovementTypeSelector dispara onChange', () => {
    const onChange = jest.fn();
    render(<MovementTypeSelector value={MovementType.IN} onChange={onChange} />);
    fireEvent.press(screen.getByText('Saída'));
    expect(onChange).toHaveBeenCalledWith(MovementType.OUT);
  });

  it('MovementHistoryRow mostra movimento com unidade', () => {
    render(
      <MovementHistoryRow
        movement={{ id: 'mv1', type: MovementType.OUT, quantity: 2, date: '2026-03-10', responsible: { name: 'Servo X' }, notes: null } as never}
        unit="L"
      />,
    );
    expect(screen.getByText(/Saída de 2 L/)).toBeTruthy();
  });
});

describe('ItemDetailsModal (supply-room)', () => {
  it('item null não renderiza', () => {
    const { toJSON } = renderWithClient(<ItemDetailsModal item={null} visible onClose={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it('lista movimentos do item', async () => {
    m.supplyRoom.listMovements.mockResolvedValue([
      { id: 'mv1', type: MovementType.IN, quantity: 5, date: '2026-03-10', responsible: { name: 'Servo X' }, notes: null },
    ]);
    renderWithClient(<ItemDetailsModal item={makeItem()} visible onClose={jest.fn()} />);
    await waitFor(() => expect(screen.getByText(/Entrada de 5 L/)).toBeTruthy());
  });
});

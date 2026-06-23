import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MovementType } from '@fonte/types';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/lib/test/utils';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
// WheelDatePickerModal: stub que expõe onConfirm via testID-friendly botão.
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
  api: { storeroom: { listMovements: jest.fn() } },
  resolveAssetUrl: (u: string) => u,
}));

import { api } from '@/lib/api';
import { StoreroomItemCard } from './StoreroomItemCard';
import { MovementTypeSelector } from './MovementTypeSelector';
import { LowStockAlert } from './LowStockAlert';
import { DateField } from './DateField';
import { MovementHistoryRow } from './MovementHistoryRow';
import { SubmitMovementButton } from './SubmitMovementButton';
import { NotesField } from './NotesField';
import { QuantityField } from './QuantityField';
import { ResponsibleDisplay } from './ResponsibleDisplay';
import { MovementChart } from './MovementChart';
import { NewItemForm } from './NewItemForm';
import { ItemSearchInput } from './ItemSearchInput';
import { ItemDetailsModal } from './ItemDetailsModal';
import { Alert } from 'react-native';

const m = api as unknown as { storeroom: Record<string, jest.Mock> };

function renderWithClient(ui: React.ReactElement) {
  return render(<QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>);
}

function makeItem(overrides = {}) {
  return {
    id: 'i1',
    name: 'Arroz',
    unit: 'kg',
    currentQuantity: 10,
    weeklyAverageUsage: 2,
    ...overrides,
  } as never;
}

beforeEach(() => jest.clearAllMocks());

describe('StoreroomItemCard', () => {
  it('mostra estoque, média e autonomia; badge Baixo quando ≤ 5', () => {
    render(<StoreroomItemCard item={makeItem({ currentQuantity: 3 })} onPress={jest.fn()} />);
    expect(screen.getByText('Arroz')).toBeTruthy();
    expect(screen.getByText(/Estoque: 3 kg/)).toBeTruthy();
    expect(screen.getByText('Baixo')).toBeTruthy();
  });

  it('sem média mostra "sem média" e dispara onPress', () => {
    const onPress = jest.fn();
    render(<StoreroomItemCard item={makeItem({ weeklyAverageUsage: 0 })} onPress={onPress} />);
    expect(screen.getByText(/Média: sem média/)).toBeTruthy();
    fireEvent.press(screen.getByText('Arroz'));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('MovementTypeSelector', () => {
  it('renderiza Entrada/Saída e dispara onChange', () => {
    const onChange = jest.fn();
    render(<MovementTypeSelector value={MovementType.IN} onChange={onChange} />);
    expect(screen.getByText('Entrada')).toBeTruthy();
    fireEvent.press(screen.getByText('Saída'));
    expect(onChange).toHaveBeenCalledWith(MovementType.OUT);
  });
});

describe('LowStockAlert', () => {
  it('lista vazia não renderiza nada', () => {
    const { toJSON } = render(<LowStockAlert items={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('singular "item" para 1; plural para vários', () => {
    const { rerender } = render(<LowStockAlert items={[makeItem()]} />);
    expect(screen.getByText(/1 item\)/)).toBeTruthy();
    rerender(<LowStockAlert items={[makeItem(), makeItem({ id: 'i2', name: 'Feijão' })]} />);
    expect(screen.getByText(/2 itens\)/)).toBeTruthy();
  });
});

describe('DateField', () => {
  it('abre o picker e propaga a data confirmada', () => {
    const onChange = jest.fn();
    render(<DateField value={new Date('2026-01-01T00:00:00')} onChange={onChange} />);
    expect(screen.getByText('01/01/2026')).toBeTruthy();
    fireEvent.press(screen.getByText('01/01/2026'));
    fireEvent.press(screen.getByText('confirm-date'));
    expect(onChange).toHaveBeenCalledWith(expect.any(Date), '2026-02-15');
  });
});

describe('MovementHistoryRow', () => {
  it('mostra entrada com responsável e nota', () => {
    render(
      <MovementHistoryRow
        movement={{ id: 'mv1', type: MovementType.IN, quantity: 5, date: '2026-03-10', responsible: { name: 'Servo X' }, notes: 'compra' } as never}
        unit="kg"
      />,
    );
    expect(screen.getByText(/Entrada de 5 kg/)).toBeTruthy();
    expect(screen.getByText(/Servo X/)).toBeTruthy();
    expect(screen.getByText('compra')).toBeTruthy();
  });

  it('saída sem responsável mostra "Sem responsável" e sem nota', () => {
    render(
      <MovementHistoryRow
        movement={{ id: 'mv2', type: MovementType.OUT, quantity: 2, date: '2026-03-10', responsible: null, notes: null } as never}
        unit="kg"
      />,
    );
    expect(screen.getByText(/Saída de 2 kg/)).toBeTruthy();
    expect(screen.getByText(/Sem responsável/)).toBeTruthy();
  });
});

describe('SubmitMovementButton', () => {
  it('rótulo de entrada/saída e onPress', () => {
    const onPress = jest.fn();
    const { rerender } = render(<SubmitMovementButton type={MovementType.IN} isPending={false} onPress={onPress} />);
    expect(screen.getByText('Registrar entrada')).toBeTruthy();
    fireEvent.press(screen.getByText('Registrar entrada'));
    expect(onPress).toHaveBeenCalled();
    rerender(<SubmitMovementButton type={MovementType.OUT} isPending={false} onPress={onPress} />);
    expect(screen.getByText('Registrar saída')).toBeTruthy();
  });

  it('pending oculta o rótulo', () => {
    render(<SubmitMovementButton type={MovementType.IN} isPending onPress={jest.fn()} />);
    expect(screen.queryByText('Registrar entrada')).toBeNull();
  });
});

describe('NotesField / QuantityField / ResponsibleDisplay', () => {
  it('NotesField edita', () => {
    const onChange = jest.fn();
    render(<NotesField value="" onChange={onChange} />);
    fireEvent.changeText(screen.getByPlaceholderText(/compra do mercado/), 'obs');
    expect(onChange).toHaveBeenCalledWith('obs');
  });

  it('QuantityField mostra unidade, erro e edita', () => {
    const onChange = jest.fn();
    render(<QuantityField value="3" onChange={onChange} unit="kg" error="obrigatório" />);
    expect(screen.getByText(/Quantidade \(kg\)/)).toBeTruthy();
    expect(screen.getByText('obrigatório')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('0'), '5');
    expect(onChange).toHaveBeenCalledWith('5');
  });

  it('ResponsibleDisplay mostra nome ou travessão', () => {
    const { rerender } = render(<ResponsibleDisplay name="Servo X" />);
    expect(screen.getByText('Servo X')).toBeTruthy();
    rerender(<ResponsibleDisplay />);
    expect(screen.getByText('—')).toBeTruthy();
  });
});

describe('MovementChart', () => {
  it('vazio mostra placeholder', () => {
    render(<MovementChart movements={[]} unit="kg" />);
    expect(screen.getByText('Sem movimentações para este item.')).toBeTruthy();
  });

  it('com movimentos mostra a legenda e o máximo', () => {
    render(
      <MovementChart
        movements={[
          { id: 'mv1', type: MovementType.IN, quantity: 5 } as never,
          { id: 'mv2', type: MovementType.OUT, quantity: 3 } as never,
        ]}
        unit="kg"
      />,
    );
    expect(screen.getByText('Entrada')).toBeTruthy();
    expect(screen.getByText(/Máx\. 5 kg/)).toBeTruthy();
  });
});

describe('NewItemForm', () => {
  it('confirmar sem unidade alerta e não confirma', () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const onConfirm = jest.fn();
    render(<NewItemForm name="Arroz" onConfirm={onConfirm} onCancel={jest.fn()} isPending={false} />);
    fireEvent.press(screen.getByText('Cadastrar'));
    expect(Alert.alert).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirmar com unidade (trim) propaga', () => {
    const onConfirm = jest.fn();
    render(<NewItemForm name="Arroz" onConfirm={onConfirm} onCancel={jest.fn()} isPending={false} />);
    fireEvent.changeText(screen.getByPlaceholderText(/Ex: kg/), '  kg  ');
    fireEvent.press(screen.getByText('Cadastrar'));
    expect(onConfirm).toHaveBeenCalledWith('kg');
  });
});

describe('ItemSearchInput', () => {
  const items = [makeItem(), makeItem({ id: 'i2', name: 'Feijão' })];

  it('foco abre dropdown e filtra por texto', () => {
    const onChangeText = jest.fn();
    const onSelect = jest.fn();
    render(
      <ItemSearchInput
        value="fei"
        selectedItemId=""
        items={items}
        onChangeText={onChangeText}
        onSelect={onSelect}
        onConfirmNewItem={jest.fn()}
        isCreatingItem={false}
      />,
    );
    fireEvent(screen.getByPlaceholderText('Buscar item...'), 'focus');
    expect(screen.getByText('Feijão')).toBeTruthy();
    fireEvent.press(screen.getByText('Feijão'));
    expect(onSelect).toHaveBeenCalled();
  });

  it('texto sem match mostra opção de cadastrar', () => {
    render(
      <ItemSearchInput
        value="Macarrão"
        selectedItemId=""
        items={items}
        onChangeText={jest.fn()}
        onSelect={jest.fn()}
        onConfirmNewItem={jest.fn()}
        isCreatingItem={false}
      />,
    );
    fireEvent(screen.getByPlaceholderText('Buscar item...'), 'focus');
    expect(screen.getByText(/Cadastrar "Macarrão"/)).toBeTruthy();
  });
});

describe('ItemDetailsModal', () => {
  it('item null não renderiza', () => {
    const { toJSON } = renderWithClient(<ItemDetailsModal item={null} visible onClose={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it('mostra estoque/autonomia e histórico vazio', async () => {
    m.storeroom.listMovements.mockResolvedValue([]);
    renderWithClient(<ItemDetailsModal item={makeItem()} visible onClose={jest.fn()} />);
    expect(screen.getByText('Arroz')).toBeTruthy();
    // "Sem movimentações" aparece no gráfico e no histórico (dois lugares).
    await waitFor(() =>
      expect(screen.getAllByText('Sem movimentações para este item.').length).toBeGreaterThan(0),
    );
  });

  it('lista movimentos do item', async () => {
    m.storeroom.listMovements.mockResolvedValue([
      { id: 'mv1', type: MovementType.IN, quantity: 5, date: '2026-03-10', responsible: { name: 'Servo X' }, notes: null },
    ]);
    renderWithClient(<ItemDetailsModal item={makeItem()} visible onClose={jest.fn()} />);
    await waitFor(() => expect(screen.getByText(/Entrada de 5 kg/)).toBeTruthy());
  });
});

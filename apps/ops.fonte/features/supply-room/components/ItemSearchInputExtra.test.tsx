import { fireEvent, render, screen } from '@testing-library/react-native';
import { SupplyRoomCategory } from '@fonte/types';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

import { ItemSearchInput } from './ItemSearchInput';

function makeItem(overrides = {}) {
  return {
    id: 'i1',
    name: 'Detergente',
    unit: 'L',
    currentQuantity: 8,
    category: SupplyRoomCategory.CLEANING,
    ...overrides,
  } as never;
}

const baseProps = {
  selectedItemId: '',
  items: [makeItem(), makeItem({ id: 'i2', name: 'Sabão' })],
  onChangeText: jest.fn(),
  onSelect: jest.fn(),
  onConfirmNewItem: jest.fn(),
  isCreatingItem: false,
};

beforeEach(() => jest.clearAllMocks());

describe('supply-room/ItemSearchInput', () => {
  it('digitar abre o dropdown e propaga o texto', () => {
    const onChangeText = jest.fn();
    render(<ItemSearchInput {...baseProps} value="" onChangeText={onChangeText} />);
    fireEvent.changeText(screen.getByPlaceholderText('Buscar item...'), 'det');
    expect(onChangeText).toHaveBeenCalledWith('det');
    expect(screen.getByText('Detergente')).toBeTruthy();
  });

  it('selecionar item dispara onSelect', () => {
    const onSelect = jest.fn();
    render(<ItemSearchInput {...baseProps} value="" onSelect={onSelect} />);
    fireEvent(screen.getByPlaceholderText('Buscar item...'), 'focus');
    fireEvent.press(screen.getByText('Sabão'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'i2' }));
  });

  it('sem correspondência mostra cadastrar e abre o NewItemForm', () => {
    render(<ItemSearchInput {...baseProps} value="Cloro" items={[]} />);
    fireEvent(screen.getByPlaceholderText('Buscar item...'), 'focus');
    fireEvent.press(screen.getByText('+ Cadastrar "Cloro"'));
    expect(screen.getByText('Cadastrar')).toBeTruthy();
  });

  it('item selecionado mostra o estoque com o dropdown fechado', () => {
    render(
      <ItemSearchInput {...baseProps} value="Detergente" selectedItemId="i1" selectedItem={makeItem()} />,
    );
    expect(screen.getByText(/8 L em estoque/)).toBeTruthy();
  });
});

import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

import { ItemSearchInput } from './ItemSearchInput';

function makeItem(overrides = {}) {
  return { id: 'i1', name: 'Arroz', unit: 'kg', currentQuantity: 12, ...overrides } as never;
}

const baseProps = {
  selectedItemId: '',
  items: [makeItem(), makeItem({ id: 'i2', name: 'Feijão' })],
  onChangeText: jest.fn(),
  onSelect: jest.fn(),
  onConfirmNewItem: jest.fn(),
  isCreatingItem: false,
};

beforeEach(() => jest.clearAllMocks());

describe('storeroom/ItemSearchInput', () => {
  it('digitar abre o dropdown e propaga o texto', () => {
    const onChangeText = jest.fn();
    render(<ItemSearchInput {...baseProps} value="" onChangeText={onChangeText} />);
    fireEvent.changeText(screen.getByPlaceholderText('Buscar item...'), 'arr');
    expect(onChangeText).toHaveBeenCalledWith('arr');
    expect(screen.getByText('Arroz')).toBeTruthy();
  });

  it('selecionar item dispara onSelect e fecha o dropdown', () => {
    const onSelect = jest.fn();
    render(<ItemSearchInput {...baseProps} value="" onSelect={onSelect} />);
    fireEvent(screen.getByPlaceholderText('Buscar item...'), 'focus');
    fireEvent.press(screen.getByText('Feijão'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'i2' }));
  });

  it('sem correspondência mostra opção de cadastrar novo item e abre o form', () => {
    render(<ItemSearchInput {...baseProps} value="Macarrão" items={[]} />);
    fireEvent(screen.getByPlaceholderText('Buscar item...'), 'focus');
    expect(screen.getByText('+ Cadastrar "Macarrão"')).toBeTruthy();
    fireEvent.press(screen.getByText('+ Cadastrar "Macarrão"'));
    // NewItemForm aparece (botão Cadastrar)
    expect(screen.getByText('Cadastrar')).toBeTruthy();
  });

  it('item selecionado mostra o estoque quando o dropdown está fechado', () => {
    render(
      <ItemSearchInput
        {...baseProps}
        value="Arroz"
        selectedItemId="i1"
        selectedItem={makeItem()}
      />,
    );
    expect(screen.getByText(/12 kg em estoque/)).toBeTruthy();
  });

  it('mostra erro e mensagem de "Nenhum item encontrado" para busca sem itens', () => {
    render(<ItemSearchInput {...baseProps} value="" items={[]} error="obrigatório" />);
    expect(screen.getByText('obrigatório')).toBeTruthy();
    fireEvent(screen.getByPlaceholderText('Buscar item...'), 'focus');
    expect(screen.getByText('Nenhum item encontrado.')).toBeTruthy();
  });
});

import { render, screen, fireEvent } from '@testing-library/react-native';
import { useState } from 'react';

// @expo/vector-icons depende de fontes nativas (indisponível no jest-expo): stub.
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

import { PasswordInput } from './PasswordInput';

describe('PasswordInput (story 173)', () => {
  it('renderiza oculto por padrão, oferecendo "mostrar-senha"', () => {
    render(<PasswordInput accessibilityLabel="input-senha" />);

    expect(screen.getByLabelText('input-senha').props.secureTextEntry).toBe(true);
    expect(screen.getByLabelText('mostrar-senha')).toBeOnTheScreen();
    expect(screen.getByText('icon:eye-outline')).toBeOnTheScreen();
  });

  it('tocar em "mostrar-senha" revela o texto e inverte o rótulo do botão', () => {
    render(<PasswordInput accessibilityLabel="input-senha" />);

    fireEvent.press(screen.getByLabelText('mostrar-senha'));

    expect(screen.getByLabelText('input-senha').props.secureTextEntry).toBe(false);
    expect(screen.getByLabelText('ocultar-senha')).toBeOnTheScreen();
    expect(screen.getByText('icon:eye-off-outline')).toBeOnTheScreen();
  });

  it('segundo toque volta a ocultar', () => {
    render(<PasswordInput accessibilityLabel="input-senha" />);

    fireEvent.press(screen.getByLabelText('mostrar-senha'));
    fireEvent.press(screen.getByLabelText('ocultar-senha'));

    expect(screen.getByLabelText('input-senha').props.secureTextEntry).toBe(true);
    expect(screen.getByLabelText('mostrar-senha')).toBeOnTheScreen();
  });

  it('duas instâncias na mesma tela têm estado independente', () => {
    render(
      <>
        <PasswordInput accessibilityLabel="input-nova-senha" />
        <PasswordInput accessibilityLabel="input-confirmar-senha" />
      </>,
    );

    fireEvent.press(screen.getAllByLabelText('mostrar-senha')[0]);

    expect(screen.getByLabelText('input-nova-senha').props.secureTextEntry).toBe(false);
    expect(screen.getByLabelText('input-confirmar-senha').props.secureTextEntry).toBe(true);
  });

  it('o valor digitado sobrevive ao toggle', () => {
    function Wrapper() {
      const [value, setValue] = useState('');
      return (
        <PasswordInput
          accessibilityLabel="input-senha"
          value={value}
          onChangeText={setValue}
        />
      );
    }
    render(<Wrapper />);

    fireEvent.changeText(screen.getByLabelText('input-senha'), 'segredo123');
    fireEvent.press(screen.getByLabelText('mostrar-senha'));

    const input = screen.getByLabelText('input-senha');
    expect(input.props.value).toBe('segredo123');
    expect(input.props.secureTextEntry).toBe(false);
  });

  it('repassa placeholder, className e onSubmitEditing para o campo', () => {
    const onSubmitEditing = jest.fn();
    render(
      <PasswordInput
        accessibilityLabel="input-senha"
        className="border border-gray-300"
        placeholder="••••••••"
        onSubmitEditing={onSubmitEditing}
      />,
    );

    const input = screen.getByPlaceholderText('••••••••');
    fireEvent(input, 'submitEditing');

    expect(onSubmitEditing).toHaveBeenCalled();
    expect(screen.getByLabelText('input-senha')).toBeOnTheScreen();
  });
});

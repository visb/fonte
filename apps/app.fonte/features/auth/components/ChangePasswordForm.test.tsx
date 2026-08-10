import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

// @expo/vector-icons depende de fontes nativas (indisponível no jest-expo): stub.
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

const mockChangePassword = jest.fn();
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ changePassword: mockChangePassword }),
}));

import { ChangePasswordForm } from './ChangePasswordForm';

beforeEach(() => jest.clearAllMocks());

describe('ChangePasswordForm', () => {
  it('valida senha curta (mínimo 6) sem chamar changePassword', async () => {
    render(<ChangePasswordForm onSuccess={jest.fn()} />);

    fireEvent.changeText(screen.getByLabelText('input-nova-senha'), '123');
    fireEvent.changeText(screen.getByLabelText('input-confirmar-senha'), '123');
    fireEvent.press(screen.getByText('Salvar senha'));

    expect(await screen.findByText('A senha deve ter pelo menos 6 caracteres')).toBeOnTheScreen();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('valida que as senhas coincidem', async () => {
    render(<ChangePasswordForm onSuccess={jest.fn()} />);

    fireEvent.changeText(screen.getByLabelText('input-nova-senha'), 'segredo1');
    fireEvent.changeText(screen.getByLabelText('input-confirmar-senha'), 'segredo2');
    fireEvent.press(screen.getByText('Salvar senha'));

    expect(await screen.findByText('As senhas não coincidem.')).toBeOnTheScreen();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('chama changePassword e onSuccess quando válido', async () => {
    mockChangePassword.mockResolvedValue(undefined);
    const onSuccess = jest.fn();
    render(<ChangePasswordForm onSuccess={onSuccess} />);

    fireEvent.changeText(screen.getByLabelText('input-nova-senha'), 'segredo1');
    fireEvent.changeText(screen.getByLabelText('input-confirmar-senha'), 'segredo1');
    fireEvent.press(screen.getByText('Salvar senha'));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(mockChangePassword).toHaveBeenCalledWith('segredo1');
  });

  it('mostra erro quando changePassword falha', async () => {
    mockChangePassword.mockRejectedValue(new Error('falha'));
    render(<ChangePasswordForm onSuccess={jest.fn()} />);

    fireEvent.changeText(screen.getByLabelText('input-nova-senha'), 'segredo1');
    fireEvent.changeText(screen.getByLabelText('input-confirmar-senha'), 'segredo1');
    fireEvent.press(screen.getByText('Salvar senha'));

    expect(await screen.findByText('Erro ao alterar senha. Tente novamente.')).toBeOnTheScreen();
  });

  // Story 173 — revelar "nova senha" não revela "confirmar senha".
  it('cada campo tem seu próprio toggle de visibilidade', () => {
    render(<ChangePasswordForm onSuccess={jest.fn()} />);

    fireEvent.changeText(screen.getByLabelText('input-nova-senha'), 'segredo1');
    fireEvent.press(screen.getAllByLabelText('mostrar-senha')[0]);

    expect(screen.getByLabelText('input-nova-senha').props.secureTextEntry).toBe(false);
    expect(screen.getByLabelText('input-nova-senha').props.value).toBe('segredo1');
    expect(screen.getByLabelText('input-confirmar-senha').props.secureTextEntry).toBe(true);
  });
});

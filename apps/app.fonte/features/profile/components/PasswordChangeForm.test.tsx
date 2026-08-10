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

import { PasswordChangeForm } from './PasswordChangeForm';

beforeEach(() => jest.clearAllMocks());

// "Alterar senha" aparece como título da seção e como rótulo do botão; o botão
// é o último.
function pressSubmit() {
  const els = screen.getAllByText('Alterar senha');
  fireEvent.press(els[els.length - 1]);
}

function fillPasswords(pw: string, confirm: string) {
  const inputs = screen.getAllByPlaceholderText('••••••••');
  fireEvent.changeText(inputs[0], pw);
  fireEvent.changeText(inputs[1], confirm);
}

describe('PasswordChangeForm', () => {
  it('valida senha curta sem chamar changePassword', async () => {
    render(<PasswordChangeForm />);
    fillPasswords('12', '12');
    pressSubmit();

    expect(await screen.findByText('Mínimo 6 caracteres')).toBeOnTheScreen();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('valida senhas diferentes', async () => {
    render(<PasswordChangeForm />);
    fillPasswords('segredo1', 'segredo2');
    pressSubmit();

    expect(await screen.findByText('As senhas não coincidem')).toBeOnTheScreen();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('altera a senha e mostra sucesso quando válido', async () => {
    mockChangePassword.mockResolvedValue(undefined);
    render(<PasswordChangeForm />);
    fillPasswords('segredo1', 'segredo1');
    pressSubmit();

    await waitFor(() => expect(mockChangePassword).toHaveBeenCalledWith('segredo1'));
    expect(await screen.findByText('Senha alterada com sucesso!')).toBeOnTheScreen();
  });

  it('mostra erro quando changePassword falha', async () => {
    mockChangePassword.mockRejectedValue({ response: { data: { message: 'Senha fraca' } } });
    render(<PasswordChangeForm />);
    fillPasswords('segredo1', 'segredo1');
    pressSubmit();

    expect(await screen.findByText('Senha fraca')).toBeOnTheScreen();
  });

  // Story 173 — toggle por instância, sem perder o valor do formulário.
  it('alterna a visibilidade de cada campo de forma independente', () => {
    render(<PasswordChangeForm />);
    fillPasswords('segredo1', 'segredo1');

    fireEvent.press(screen.getAllByLabelText('mostrar-senha')[0]);

    const [nova, confirmar] = screen.getAllByPlaceholderText('••••••••');
    expect(nova.props.secureTextEntry).toBe(false);
    expect(nova.props.value).toBe('segredo1');
    expect(confirmar.props.secureTextEntry).toBe(true);
  });
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

// @expo/vector-icons depende de fontes nativas (indisponível no jest-expo): stub.
// O PasswordInput (story 173) usa Ionicons no botão de "ver senha".
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

const mockLogin = jest.fn();
let mockToken: string | null = null;
let mockSessionExpired = false;
jest.mock('@/lib/auth', () => {
  const actual = jest.requireActual('@/lib/auth');
  return {
    ...actual,
    useAuth: () => ({
      login: mockLogin,
      token: mockToken,
      sessionExpired: mockSessionExpired,
    }),
  };
});

import { MustChangePasswordError } from '@/lib/auth';
import LoginScreen from './login';

beforeEach(() => {
  jest.clearAllMocks();
  mockToken = null;
  mockSessionExpired = false;
});

describe('LoginScreen (ops.fonte)', () => {
  it('não mostra o aviso de sessão expirada no estado normal', () => {
    render(<LoginScreen />);
    expect(screen.queryByLabelText('aviso-sessao-expirada')).toBeNull();
  });

  it('mostra o aviso quando a sessão expirou', () => {
    mockSessionExpired = true;
    render(<LoginScreen />);
    expect(screen.getByLabelText('aviso-sessao-expirada')).toBeOnTheScreen();
    expect(screen.getByText('Sua sessão expirou. Entre novamente.')).toBeOnTheScreen();
  });

  it('esconde o aviso ao submeter o formulário', async () => {
    mockSessionExpired = true;
    mockLogin.mockResolvedValue(undefined);
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByLabelText('input-email'), 'user@fonte.com');
    fireEvent.changeText(screen.getByLabelText('input-senha'), 'segredo');
    fireEvent.press(screen.getByText('Entrar'));

    await waitFor(() => expect(screen.queryByLabelText('aviso-sessao-expirada')).toBeNull());
    expect(mockLogin).toHaveBeenCalledWith('user@fonte.com', 'segredo');
  });

  it('esconde o aviso mesmo quando o submit é barrado por campos vazios', async () => {
    mockSessionExpired = true;
    render(<LoginScreen />);

    fireEvent.press(screen.getByText('Entrar'));

    // Validação do zod por campo (story 173) — não mais um erro único no topo.
    await waitFor(() => expect(screen.getByText('Informe WhatsApp ou e-mail.')).toBeOnTheScreen());
    expect(screen.getByText('Informe sua senha.')).toBeOnTheScreen();
    expect(screen.queryByLabelText('aviso-sessao-expirada')).toBeNull();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('valida só a senha quando o identificador está preenchido', async () => {
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByLabelText('input-email'), 'user@fonte.com');
    fireEvent.press(screen.getByText('Entrar'));

    expect(await screen.findByText('Informe sua senha.')).toBeOnTheScreen();
    expect(screen.queryByText('Informe WhatsApp ou e-mail.')).toBeNull();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('mostra erro de credenciais quando o login falha', async () => {
    mockLogin.mockRejectedValue(new Error('401'));
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByLabelText('input-email'), 'user@fonte.com');
    fireEvent.changeText(screen.getByLabelText('input-senha'), 'errada');
    fireEvent.press(screen.getByText('Entrar'));

    expect(await screen.findByText('WhatsApp/e-mail ou senha incorretos.')).toBeOnTheScreen();
  });

  it('encaminha para a troca de senha quando o login exige nova senha', async () => {
    mockLogin.mockRejectedValue(new MustChangePasswordError());
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByLabelText('input-email'), 'user@fonte.com');
    fireEvent.changeText(screen.getByLabelText('input-senha'), 'temp123');
    fireEvent.press(screen.getByText('Entrar'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/change-password'));
    expect(screen.queryByText('WhatsApp/e-mail ou senha incorretos.')).toBeNull();
  });

  it('submete pelo teclado (onSubmitEditing do campo de senha)', async () => {
    mockLogin.mockResolvedValue(undefined);
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByLabelText('input-email'), 'user@fonte.com');
    fireEvent.changeText(screen.getByLabelText('input-senha'), 'segredo');
    fireEvent(screen.getByLabelText('input-senha'), 'submitEditing');

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('user@fonte.com', 'segredo'));
  });

  it('alterna a visibilidade da senha sem perder o que foi digitado (story 173)', () => {
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByLabelText('input-senha'), 'segredo');
    expect(screen.getByLabelText('input-senha').props.secureTextEntry).toBe(true);

    fireEvent.press(screen.getByLabelText('mostrar-senha'));

    const input = screen.getByLabelText('input-senha');
    expect(input.props.secureTextEntry).toBe(false);
    expect(input.props.value).toBe('segredo');
  });

  it('redireciona para a home quando já existe token', () => {
    mockToken = 'jwt';
    render(<LoginScreen />);
    expect(mockReplace).toHaveBeenCalledWith('/(app)');
  });
});

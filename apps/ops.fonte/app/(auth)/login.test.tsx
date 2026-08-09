import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

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

    await waitFor(() =>
      expect(screen.getByText('Preencha WhatsApp ou e-mail e senha.')).toBeOnTheScreen(),
    );
    expect(screen.queryByLabelText('aviso-sessao-expirada')).toBeNull();
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

  it('redireciona para a home quando já existe token', () => {
    mockToken = 'jwt';
    render(<LoginScreen />);
    expect(mockReplace).toHaveBeenCalledWith('/(app)');
  });
});

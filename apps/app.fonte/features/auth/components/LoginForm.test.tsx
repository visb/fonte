import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const mockLogin = jest.fn();
let mockSessionExpired = false;
jest.mock('@/lib/auth', () => {
  const actual = jest.requireActual('@/lib/auth');
  return {
    ...actual,
    useAuth: () => ({ login: mockLogin, sessionExpired: mockSessionExpired }),
  };
});

import { MustChangePasswordError } from '@/lib/auth';
import { LoginForm } from './LoginForm';

beforeEach(() => {
  jest.clearAllMocks();
  mockSessionExpired = false;
});

describe('LoginForm', () => {
  it('bloqueia o submit quando a senha está vazia (não chama login)', async () => {
    render(<LoginForm onSuccess={jest.fn()} onMustChangePassword={jest.fn()} />);
    // só preenche o e-mail: a senha vazia deve barrar o submit
    fireEvent.changeText(screen.getByLabelText('input-email'), 'a@b.com');
    fireEvent.press(screen.getByText('Entrar'));

    // validação async do zodResolver impede a chamada de login; senha undefined
    // produz o erro padrão "Required" do zod (a msg custom só vale para '').
    expect(await screen.findByText('Required')).toBeOnTheScreen();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('chama login e onSuccess com credenciais válidas', async () => {
    mockLogin.mockResolvedValue(undefined);
    const onSuccess = jest.fn();
    render(<LoginForm onSuccess={onSuccess} onMustChangePassword={jest.fn()} />);

    fireEvent.changeText(screen.getByLabelText('input-email'), 'a@b.com');
    fireEvent.changeText(screen.getByLabelText('input-senha'), 'segredo');
    fireEvent.press(screen.getByText('Entrar'));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(mockLogin).toHaveBeenCalledWith('a@b.com', 'segredo');
  });

  it('encaminha para troca de senha quando login lança MustChangePasswordError', async () => {
    mockLogin.mockRejectedValue(new MustChangePasswordError());
    const onMustChangePassword = jest.fn();
    render(<LoginForm onSuccess={jest.fn()} onMustChangePassword={onMustChangePassword} />);

    fireEvent.changeText(screen.getByLabelText('input-email'), 'a@b.com');
    fireEvent.changeText(screen.getByLabelText('input-senha'), 'segredo');
    fireEvent.press(screen.getByText('Entrar'));

    await waitFor(() => expect(onMustChangePassword).toHaveBeenCalled());
  });

  it('mostra erro de credenciais incorretas em falha genérica', async () => {
    mockLogin.mockRejectedValue(new Error('401'));
    render(<LoginForm onSuccess={jest.fn()} onMustChangePassword={jest.fn()} />);

    fireEvent.changeText(screen.getByLabelText('input-email'), 'a@b.com');
    fireEvent.changeText(screen.getByLabelText('input-senha'), 'errada');
    fireEvent.press(screen.getByText('Entrar'));

    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeOnTheScreen();
  });

  it('preenche credenciais de teste válidas (__DEV__) e faz login', async () => {
    mockLogin.mockResolvedValue(undefined);
    const onSuccess = jest.fn();
    render(<LoginForm onSuccess={onSuccess} onMustChangePassword={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('fill-test-credentials'));
    fireEvent.press(screen.getByText('Entrar'));

    await waitFor(() =>
      expect(mockLogin).toHaveBeenCalledWith('familiar@fonte.com', 'familiar123'),
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  it('não mostra o aviso de sessão expirada no estado normal', () => {
    render(<LoginForm onSuccess={jest.fn()} onMustChangePassword={jest.fn()} />);
    expect(screen.queryByLabelText('aviso-sessao-expirada')).toBeNull();
  });

  it('mostra o aviso de sessão expirada quando sessionExpired', () => {
    mockSessionExpired = true;
    render(<LoginForm onSuccess={jest.fn()} onMustChangePassword={jest.fn()} />);
    expect(screen.getByLabelText('aviso-sessao-expirada')).toBeOnTheScreen();
    expect(screen.getByText('Sua sessão expirou. Entre novamente.')).toBeOnTheScreen();
  });

  it('esconde o aviso de sessão expirada ao submeter o formulário', async () => {
    mockSessionExpired = true;
    mockLogin.mockResolvedValue(undefined);
    render(<LoginForm onSuccess={jest.fn()} onMustChangePassword={jest.fn()} />);

    fireEvent.changeText(screen.getByLabelText('input-email'), 'a@b.com');
    fireEvent.changeText(screen.getByLabelText('input-senha'), 'segredo');
    fireEvent.press(screen.getByText('Entrar'));

    await waitFor(() => expect(screen.queryByLabelText('aviso-sessao-expirada')).toBeNull());
  });

  it('preenche credenciais de teste inválidas (__DEV__)', async () => {
    mockLogin.mockRejectedValue(new Error('401'));
    render(<LoginForm onSuccess={jest.fn()} onMustChangePassword={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('fill-test-credentials-invalid'));
    fireEvent.press(screen.getByText('Entrar'));

    await waitFor(() =>
      expect(mockLogin).toHaveBeenCalledWith('familiar@fonte.com', 'senha_errada'),
    );
    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeOnTheScreen();
  });
});

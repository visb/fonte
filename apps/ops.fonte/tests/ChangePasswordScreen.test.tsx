import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

// @expo/vector-icons depende de fontes nativas (indisponível no jest-expo): stub.
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

const mockChangePassword = jest.fn();
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ changePassword: mockChangePassword }),
}));

// Teste fora de app/: o Expo Router empacota todo arquivo de app/ como rota no
// bundle web, e um *.test.tsx ali quebra o Metro com "jest is not defined".
import ChangePasswordScreen from '@/app/(auth)/change-password';

beforeEach(() => jest.clearAllMocks());

function fill(password: string, confirm: string) {
  fireEvent.changeText(screen.getByLabelText('input-nova-senha'), password);
  fireEvent.changeText(screen.getByLabelText('input-confirmar-senha'), confirm);
}

describe('ChangePasswordScreen (ops.fonte — primeiro acesso)', () => {
  it('senha com menos de 6 caracteres vira erro de campo e não salva', async () => {
    render(<ChangePasswordScreen />);
    fill('123', '123');
    fireEvent.press(screen.getByText('Salvar senha'));

    expect(await screen.findByText('Mínimo 6 caracteres')).toBeOnTheScreen();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('senhas diferentes viram erro no campo de confirmação', async () => {
    render(<ChangePasswordScreen />);
    fill('segredo1', 'segredo2');
    fireEvent.press(screen.getByText('Salvar senha'));

    expect(await screen.findByText('As senhas não coincidem')).toBeOnTheScreen();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('campos vazios barram o submit pelo mínimo do schema', async () => {
    render(<ChangePasswordScreen />);
    fireEvent.press(screen.getByText('Salvar senha'));

    expect(await screen.findByText('Mínimo 6 caracteres')).toBeOnTheScreen();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('caso feliz chama changePassword e navega para a home', async () => {
    mockChangePassword.mockResolvedValue(undefined);
    render(<ChangePasswordScreen />);
    fill('segredo1', 'segredo1');
    fireEvent.press(screen.getByText('Salvar senha'));

    await waitFor(() => expect(mockChangePassword).toHaveBeenCalledWith('segredo1'));
    expect(mockReplace).toHaveBeenCalledWith('/(app)');
  });

  it('falha da API vira erro geral e não navega', async () => {
    mockChangePassword.mockRejectedValue(new Error('500'));
    render(<ChangePasswordScreen />);
    fill('segredo1', 'segredo1');
    fireEvent.press(screen.getByText('Salvar senha'));

    expect(
      await screen.findByText('Não foi possível alterar a senha. Tente novamente.'),
    ).toBeOnTheScreen();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('cada campo tem seu próprio toggle de visibilidade (story 173)', () => {
    render(<ChangePasswordScreen />);
    fill('segredo1', 'segredo1');

    fireEvent.press(screen.getAllByLabelText('mostrar-senha')[0]);

    expect(screen.getByLabelText('input-nova-senha').props.secureTextEntry).toBe(false);
    expect(screen.getByLabelText('input-nova-senha').props.value).toBe('segredo1');
    expect(screen.getByLabelText('input-confirmar-senha').props.secureTextEntry).toBe(true);
  });

  it('submete pelo teclado no campo de confirmação', async () => {
    mockChangePassword.mockResolvedValue(undefined);
    render(<ChangePasswordScreen />);
    fill('segredo1', 'segredo1');

    fireEvent(screen.getByLabelText('input-confirmar-senha'), 'submitEditing');

    await waitFor(() => expect(mockChangePassword).toHaveBeenCalledWith('segredo1'));
  });
});

import { Text, TouchableOpacity } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@/lib/api', () => ({
  api: {
    auth: { login: jest.fn(), changePassword: jest.fn() },
    relatives: { me: jest.fn() },
  },
}));

import { api } from '@/lib/api';
import { AuthProvider, useAuth, MustChangePasswordError } from './auth';

const mockApi = api as unknown as {
  auth: { login: jest.Mock; changePassword: jest.Mock };
  relatives: { me: jest.Mock };
};

function Consumer() {
  const { token, relative, isLoading, login, logout, changePassword, refreshRelative } = useAuth();
  return (
    <>
      <Text accessibilityLabel="loading">{String(isLoading)}</Text>
      <Text accessibilityLabel="token">{token ?? 'none'}</Text>
      <Text accessibilityLabel="relative">{relative?.name ?? 'none'}</Text>
      <TouchableOpacity accessibilityLabel="login" onPress={() => login('a@b.com', 'pw').catch(() => {})}>
        <Text>login</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityLabel="logout" onPress={() => logout()}>
        <Text>logout</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityLabel="change" onPress={() => changePassword('newpass')}>
        <Text>change</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityLabel="refresh" onPress={() => refreshRelative()}>
        <Text>refresh</Text>
      </TouchableOpacity>
    </>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>,
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('AuthProvider', () => {
  it('hidrata token/relative do AsyncStorage no mount', async () => {
    await AsyncStorage.setItem('token', 'stored-token');
    await AsyncStorage.setItem('relative', JSON.stringify({ name: 'Ana' }));

    renderAuth();

    await waitFor(() => expect(screen.getByLabelText('loading')).toHaveTextContent('false'));
    expect(screen.getByLabelText('token')).toHaveTextContent('stored-token');
    expect(screen.getByLabelText('relative')).toHaveTextContent('Ana');
  });

  it('login grava token e relative e atualiza o estado', async () => {
    mockApi.auth.login.mockResolvedValue({ accessToken: 'jwt-1' });
    mockApi.relatives.me.mockResolvedValue({ name: 'Bia' });

    renderAuth();
    await waitFor(() => expect(screen.getByLabelText('loading')).toHaveTextContent('false'));

    await act(async () => {
      fireEvent.press(screen.getByLabelText('login'));
    });

    await waitFor(() => expect(screen.getByLabelText('relative')).toHaveTextContent('Bia'));
    expect(screen.getByLabelText('token')).toHaveTextContent('jwt-1');
    expect(await AsyncStorage.getItem('token')).toBe('jwt-1');
  });

  it('login lança MustChangePasswordError e mantém o token salvo', async () => {
    mockApi.auth.login.mockResolvedValue({ accessToken: 'jwt-mcp' });
    mockApi.relatives.me.mockRejectedValue({
      response: { data: { error: 'MUST_CHANGE_PASSWORD' } },
    });

    let caught: unknown;
    function Probe() {
      const { login } = useAuth();
      return (
        <TouchableOpacity
          accessibilityLabel="login-mcp"
          onPress={() => login('a@b.com', 'pw').catch((e) => { caught = e; })}
        >
          <Text>go</Text>
        </TouchableOpacity>
      );
    }
    render(<AuthProvider><Probe /></AuthProvider>);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('login-mcp'));
    });

    await waitFor(() => expect(caught).toBeInstanceOf(MustChangePasswordError));
    // token mantido para changePassword() poder autenticar
    expect(await AsyncStorage.getItem('token')).toBe('jwt-mcp');
  });

  it('login remove o token quando o erro não é MUST_CHANGE_PASSWORD', async () => {
    mockApi.auth.login.mockResolvedValue({ accessToken: 'jwt-bad' });
    mockApi.relatives.me.mockRejectedValue({ response: { data: { error: 'OTHER' } } });

    renderAuth();
    await waitFor(() => expect(screen.getByLabelText('loading')).toHaveTextContent('false'));

    await act(async () => {
      fireEvent.press(screen.getByLabelText('login'));
    });

    await waitFor(() => expect(mockApi.relatives.me).toHaveBeenCalled());
    expect(await AsyncStorage.getItem('token')).toBeNull();
  });

  it('changePassword troca a senha, grava novo token e relative', async () => {
    mockApi.auth.changePassword.mockResolvedValue({ accessToken: 'jwt-new' });
    mockApi.relatives.me.mockResolvedValue({ name: 'Cau' });

    renderAuth();
    await waitFor(() => expect(screen.getByLabelText('loading')).toHaveTextContent('false'));

    await act(async () => {
      fireEvent.press(screen.getByLabelText('change'));
    });

    await waitFor(() => expect(screen.getByLabelText('token')).toHaveTextContent('jwt-new'));
    expect(screen.getByLabelText('relative')).toHaveTextContent('Cau');
    expect(mockApi.auth.changePassword).toHaveBeenCalledWith({ newPassword: 'newpass' });
  });

  it('logout limpa token e relative', async () => {
    await AsyncStorage.setItem('token', 't');
    await AsyncStorage.setItem('relative', JSON.stringify({ name: 'X' }));

    renderAuth();
    await waitFor(() => expect(screen.getByLabelText('token')).toHaveTextContent('t'));

    await act(async () => {
      fireEvent.press(screen.getByLabelText('logout'));
    });

    await waitFor(() => expect(screen.getByLabelText('token')).toHaveTextContent('none'));
    expect(await AsyncStorage.getItem('token')).toBeNull();
    expect(await AsyncStorage.getItem('relative')).toBeNull();
  });

  it('refreshRelative recarrega e persiste o relative', async () => {
    mockApi.relatives.me.mockResolvedValue({ name: 'Atualizada' });

    renderAuth();
    await waitFor(() => expect(screen.getByLabelText('loading')).toHaveTextContent('false'));

    await act(async () => {
      fireEvent.press(screen.getByLabelText('refresh'));
    });

    await waitFor(() => expect(screen.getByLabelText('relative')).toHaveTextContent('Atualizada'));
  });

  it('cai no catch da hidratação quando o AsyncStorage falha', async () => {
    const spy = jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValueOnce(new Error('storage boom'));

    renderAuth();

    await waitFor(() => expect(screen.getByLabelText('loading')).toHaveTextContent('false'));
    expect(screen.getByLabelText('token')).toHaveTextContent('none');
    expect(screen.getByLabelText('relative')).toHaveTextContent('none');
    spy.mockRestore();
  });

  it('useAuth fora do provider lança erro', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow('useAuth must be used within AuthProvider');
    spy.mockRestore();
  });
});

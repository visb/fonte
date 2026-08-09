import { Text, TouchableOpacity } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@/lib/api', () => ({
  api: {
    auth: { login: jest.fn(), changePassword: jest.fn() },
    relatives: { me: jest.fn() },
  },
  setUnauthorizedHandler: jest.fn(),
}));

import { api, setUnauthorizedHandler } from '@/lib/api';
import { AuthProvider, useAuth, MustChangePasswordError } from './auth';

const mockApi = api as unknown as {
  auth: { login: jest.Mock; changePassword: jest.Mock };
  relatives: { me: jest.Mock };
};

const setHandler = setUnauthorizedHandler as unknown as jest.Mock;

/** Dispara o handler global de 401 que o AuthProvider registrou em lib/api. */
async function triggerUnauthorized(url = '/relatives/me') {
  const registered = setHandler.mock.calls
    .map(([fn]) => fn)
    .filter((fn): fn is (ctx: { url?: string }) => void => typeof fn === 'function')
    .pop();
  if (!registered) throw new Error('AuthProvider não registrou o handler de 401');
  await act(async () => {
    registered({ url });
  });
}

function Consumer() {
  const {
    token,
    relative,
    isLoading,
    sessionExpired,
    login,
    logout,
    changePassword,
    refreshRelative,
  } = useAuth();
  return (
    <>
      <Text accessibilityLabel="loading">{String(isLoading)}</Text>
      <Text accessibilityLabel="token">{token ?? 'none'}</Text>
      <Text accessibilityLabel="relative">{relative?.name ?? 'none'}</Text>
      <Text accessibilityLabel="expired">{String(sessionExpired)}</Text>
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
    // `mockRejectedValueOnce` direto no mock oficial: `spyOn(...).mockRestore()` aqui
    // apagaria a implementação in-memory do AsyncStorage para os testes seguintes
    // (spyOn sobre função já mockada devolve o próprio mock; restore vira reset).
    (AsyncStorage.getItem as unknown as jest.Mock).mockRejectedValueOnce(
      new Error('storage boom'),
    );

    renderAuth();

    await waitFor(() => expect(screen.getByLabelText('loading')).toHaveTextContent('false'));
    expect(screen.getByLabelText('token')).toHaveTextContent('none');
    expect(screen.getByLabelText('relative')).toHaveTextContent('none');
  });

  it('useAuth fora do provider lança erro', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow('useAuth must be used within AuthProvider');
    spy.mockRestore();
  });
});

describe('AuthProvider — sessão expirada (401 global)', () => {
  async function renderReady() {
    renderAuth();
    await waitFor(() => expect(screen.getByLabelText('loading')).toHaveTextContent('false'));
  }

  it('registra o handler de 401 no mount e desregistra no unmount', async () => {
    const view = renderAuth();
    await waitFor(() => expect(screen.getByLabelText('loading')).toHaveTextContent('false'));
    expect(setHandler).toHaveBeenCalledWith(expect.any(Function));

    view.unmount();
    expect(setHandler).toHaveBeenLastCalledWith(null);
  });

  it('começa com sessionExpired false', async () => {
    await renderReady();
    expect(screen.getByLabelText('expired')).toHaveTextContent('false');
  });

  it('401 limpa storage, zera token/relative e liga sessionExpired', async () => {
    await AsyncStorage.setItem('token', 't');
    await AsyncStorage.setItem('relative', JSON.stringify({ name: 'Ana' }));
    await renderReady();
    expect(screen.getByLabelText('token')).toHaveTextContent('t');

    await triggerUnauthorized();

    expect(screen.getByLabelText('token')).toHaveTextContent('none');
    expect(screen.getByLabelText('relative')).toHaveTextContent('none');
    expect(screen.getByLabelText('expired')).toHaveTextContent('true');
    expect(await AsyncStorage.getItem('token')).toBeNull();
    expect(await AsyncStorage.getItem('relative')).toBeNull();
  });

  it('401 concorrentes não duplicam o efeito (handler idempotente)', async () => {
    // Usa o próprio mock (sem spyOn/mockRestore, que apagaria a implementação).
    const multiRemove = AsyncStorage.multiRemove as unknown as jest.Mock;
    await AsyncStorage.setItem('token', 't');
    await renderReady();
    multiRemove.mockClear();

    await triggerUnauthorized();
    await triggerUnauthorized();

    expect(multiRemove).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('expired')).toHaveTextContent('true');
  });

  it('logout manual não liga sessionExpired', async () => {
    await AsyncStorage.setItem('token', 't');
    await renderReady();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('logout'));
    });

    expect(screen.getByLabelText('expired')).toHaveTextContent('false');
  });

  it('login bem-sucedido desliga sessionExpired e rearma o handler', async () => {
    mockApi.auth.login.mockResolvedValue({ accessToken: 'jwt-novo' });
    mockApi.relatives.me.mockResolvedValue({ name: 'Bia' });
    await renderReady();

    await triggerUnauthorized();
    expect(screen.getByLabelText('expired')).toHaveTextContent('true');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('login'));
    });
    await waitFor(() => expect(screen.getByLabelText('expired')).toHaveTextContent('false'));
    expect(screen.getByLabelText('token')).toHaveTextContent('jwt-novo');

    await triggerUnauthorized();
    expect(screen.getByLabelText('expired')).toHaveTextContent('true');
  });

  it('changePassword desliga sessionExpired', async () => {
    mockApi.auth.changePassword.mockResolvedValue({ accessToken: 'jwt-new' });
    mockApi.relatives.me.mockResolvedValue({ name: 'Cau' });
    await renderReady();

    await triggerUnauthorized();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('change'));
    });

    await waitFor(() => expect(screen.getByLabelText('expired')).toHaveTextContent('false'));
  });

  it('logout após expiração rearma o handler para o próximo 401', async () => {
    await AsyncStorage.setItem('token', 't');
    await renderReady();

    await triggerUnauthorized();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('logout'));
    });
    expect(screen.getByLabelText('expired')).toHaveTextContent('false');

    await triggerUnauthorized();
    expect(screen.getByLabelText('expired')).toHaveTextContent('true');
  });
});

import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ProfileType, StaffPermissionType } from '@fonte/types';

jest.mock('./api', () => ({
  api: {
    auth: { login: jest.fn(), changePassword: jest.fn() },
    staff: { me: jest.fn() },
    residents: { me: jest.fn() },
  },
  setUnauthorizedHandler: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setUnauthorizedHandler } from './api';
import { AuthProvider, useAuth, MustChangePasswordError } from './auth';

const m = api as unknown as {
  auth: Record<string, jest.Mock>;
  staff: Record<string, jest.Mock>;
  residents: Record<string, jest.Mock>;
};

const setHandler = setUnauthorizedHandler as unknown as jest.Mock;

/** Dispara o handler global de 401 que o AuthProvider registrou em lib/api. */
async function triggerUnauthorized(url = '/residents') {
  const registered = setHandler.mock.calls
    .map(([fn]) => fn)
    .filter((fn): fn is (ctx: { url?: string }) => void => typeof fn === 'function')
    .pop();
  if (!registered) throw new Error('AuthProvider não registrou o handler de 401');
  await act(async () => {
    registered({ url });
  });
}

let auth: ReturnType<typeof useAuth>;
function Probe() {
  auth = useAuth();
  return (
    <Text>
      {`token=${auth.token ?? '-'} resident=${auth.isResident} canSend=${auth.canSendMessagesToFamilies} canMod=${auth.canModerateMessages} loading=${auth.isLoading}`}
    </Text>
  );
}

async function renderAuth() {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(auth.isLoading).toBe(false));
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('AuthProvider', () => {
  it('useAuth fora do provider lança erro', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    function Bad() {
      useAuth();
      return null;
    }
    expect(() => render(<Bad />)).toThrow('useAuth must be used within AuthProvider');
    spy.mockRestore();
  });

  it('hidrata do AsyncStorage na montagem (staff salvo)', async () => {
    await AsyncStorage.setItem('token', 'jwt');
    await AsyncStorage.setItem('staff', JSON.stringify({ id: 's1', permissions: [] }));
    await renderAuth();
    expect(auth.token).toBe('jwt');
    expect(auth.staff?.id).toBe('s1');
  });

  it('login de staff guarda token+staff e remove resident', async () => {
    m.auth.login.mockResolvedValue({ accessToken: 'jwt-staff', profileType: ProfileType.STAFF });
    m.staff.me.mockResolvedValue({ id: 's1', permissions: [StaffPermissionType.SEND_MESSAGES_TO_FAMILIES] });
    await renderAuth();
    await act(async () => {
      await auth.login('user@fonte.com', 'pw');
    });
    expect(await AsyncStorage.getItem('token')).toBe('jwt-staff');
    expect(auth.staff?.id).toBe('s1');
    expect(auth.canSendMessagesToFamilies).toBe(true);
    expect(auth.isResident).toBe(false);
  });

  it('login de resident guarda resident e marca isResident', async () => {
    m.auth.login.mockResolvedValue({ accessToken: 'jwt-res', profileType: ProfileType.RESIDENT });
    m.residents.me.mockResolvedValue({ id: 'r1' });
    await renderAuth();
    await act(async () => {
      await auth.login('interno', 'pw');
    });
    expect(auth.resident?.id).toBe('r1');
    expect(auth.isResident).toBe(true);
  });

  it('login lança MustChangePasswordError quando o backend exige troca', async () => {
    m.auth.login.mockResolvedValue({ accessToken: 'jwt', profileType: ProfileType.STAFF });
    m.staff.me.mockRejectedValue({ response: { data: { error: 'MUST_CHANGE_PASSWORD' } } });
    await renderAuth();
    await expect(
      act(async () => {
        await auth.login('user', 'pw');
      }),
    ).rejects.toBeInstanceOf(MustChangePasswordError);
  });

  it('changePassword troca a senha e recarrega o staff', async () => {
    m.auth.changePassword.mockResolvedValue({ accessToken: 'jwt2', profileType: ProfileType.STAFF });
    m.staff.me.mockResolvedValue({ id: 's1', permissions: [StaffPermissionType.MODERATE_MESSAGES] });
    await renderAuth();
    await act(async () => {
      await auth.changePassword('novaSenha');
    });
    expect(auth.token).toBe('jwt2');
    expect(auth.canModerateMessages).toBe(true);
  });

  it('logout limpa o estado e o storage', async () => {
    await AsyncStorage.setItem('token', 'jwt');
    await AsyncStorage.setItem('staff', JSON.stringify({ id: 's1', permissions: [] }));
    await renderAuth();
    await act(async () => {
      await auth.logout();
    });
    expect(auth.token).toBeNull();
    expect(auth.staff).toBeNull();
    expect(await AsyncStorage.getItem('token')).toBeNull();
  });

  it('logout manual não marca sessionExpired', async () => {
    await AsyncStorage.setItem('token', 'jwt');
    await renderAuth();
    await act(async () => {
      await auth.logout();
    });
    expect(auth.sessionExpired).toBe(false);
  });

  it('refreshStaff/refreshResident atualizam do backend', async () => {
    m.staff.me.mockResolvedValue({ id: 's1', name: 'Atualizado', permissions: [] });
    m.residents.me.mockResolvedValue({ id: 'r1', name: 'Filho' });
    await renderAuth();
    await act(async () => {
      await auth.refreshStaff();
    });
    expect(auth.staff?.name).toBe('Atualizado');
    await act(async () => {
      await auth.refreshResident();
    });
    expect(auth.resident?.name).toBe('Filho');
  });
});

describe('AuthProvider — sessão expirada (401 global)', () => {
  it('registra o handler de 401 no mount e desregistra no unmount', async () => {
    const view = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(auth.isLoading).toBe(false));
    expect(setHandler).toHaveBeenCalledWith(expect.any(Function));

    view.unmount();
    expect(setHandler).toHaveBeenLastCalledWith(null);
  });

  it('inicia com sessionExpired false', async () => {
    await renderAuth();
    expect(auth.sessionExpired).toBe(false);
  });

  it('401 limpa storage, zera token/staff/resident e liga sessionExpired', async () => {
    await AsyncStorage.setItem('token', 'jwt');
    await AsyncStorage.setItem('staff', JSON.stringify({ id: 's1', permissions: [] }));
    await renderAuth();
    expect(auth.token).toBe('jwt');

    await triggerUnauthorized();

    expect(auth.token).toBeNull();
    expect(auth.staff).toBeNull();
    expect(auth.resident).toBeNull();
    expect(auth.sessionExpired).toBe(true);
    expect(await AsyncStorage.getItem('token')).toBeNull();
    expect(await AsyncStorage.getItem('staff')).toBeNull();
  });

  it('401 do modo resident também derruba a sessão', async () => {
    await AsyncStorage.setItem('token', 'jwt');
    await AsyncStorage.setItem('resident', JSON.stringify({ id: 'r1' }));
    await renderAuth();
    expect(auth.isResident).toBe(true);

    await triggerUnauthorized('/resident-sessions/today');

    expect(auth.token).toBeNull();
    expect(auth.isResident).toBe(false);
    expect(auth.sessionExpired).toBe(true);
    expect(await AsyncStorage.getItem('resident')).toBeNull();
  });

  it('401 concorrentes não duplicam o efeito (handler idempotente)', async () => {
    // Usa o próprio mock (sem spyOn/mockRestore, que apagaria a implementação
    // in-memory do AsyncStorage para os testes seguintes).
    const multiRemove = AsyncStorage.multiRemove as unknown as jest.Mock;
    await AsyncStorage.setItem('token', 'jwt');
    await renderAuth();
    multiRemove.mockClear();

    await triggerUnauthorized();
    await triggerUnauthorized();

    expect(multiRemove).toHaveBeenCalledTimes(1);
    expect(auth.sessionExpired).toBe(true);
  });

  it('login bem-sucedido desliga sessionExpired e volta a aceitar novo 401', async () => {
    m.auth.login.mockResolvedValue({ accessToken: 'jwt-novo', profileType: ProfileType.STAFF });
    m.staff.me.mockResolvedValue({ id: 's1', permissions: [] });
    await renderAuth();

    await triggerUnauthorized();
    expect(auth.sessionExpired).toBe(true);

    await act(async () => {
      await auth.login('user@fonte.com', 'pw');
    });
    expect(auth.sessionExpired).toBe(false);
    expect(auth.token).toBe('jwt-novo');

    // ref rearmada: um novo 401 volta a derrubar a sessão
    await triggerUnauthorized();
    expect(auth.sessionExpired).toBe(true);
    expect(auth.token).toBeNull();
  });

  it('changePassword desliga sessionExpired', async () => {
    m.auth.changePassword.mockResolvedValue({ accessToken: 'jwt2', profileType: ProfileType.STAFF });
    m.staff.me.mockResolvedValue({ id: 's1', permissions: [] });
    await renderAuth();

    await triggerUnauthorized();
    await act(async () => {
      await auth.changePassword('novaSenha');
    });

    expect(auth.sessionExpired).toBe(false);
  });

  it('logout após expiração rearma o handler para o próximo 401', async () => {
    await AsyncStorage.setItem('token', 'jwt');
    await renderAuth();

    await triggerUnauthorized();
    await act(async () => {
      await auth.logout();
    });
    expect(auth.sessionExpired).toBe(false);

    await triggerUnauthorized();
    expect(auth.sessionExpired).toBe(true);
  });
});

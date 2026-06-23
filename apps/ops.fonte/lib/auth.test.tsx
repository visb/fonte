import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ProfileType, StaffPermissionType } from '@fonte/types';

jest.mock('./api', () => ({
  api: {
    auth: { login: jest.fn(), changePassword: jest.fn() },
    staff: { me: jest.fn() },
    residents: { me: jest.fn() },
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { AuthProvider, useAuth, MustChangePasswordError } from './auth';

const m = api as unknown as {
  auth: Record<string, jest.Mock>;
  staff: Record<string, jest.Mock>;
  residents: Record<string, jest.Mock>;
};

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

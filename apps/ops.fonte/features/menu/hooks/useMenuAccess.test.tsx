import { renderHook } from '@testing-library/react-native';
import { Role } from '@fonte/types';

const mockAuth = jest.fn();
const mockHouseById = jest.fn();

jest.mock('@/lib/auth', () => ({ useAuth: () => mockAuth() }));
jest.mock('@/features/house-settings/hooks/useHouseSettings', () => ({
  useHouseById: (...args: unknown[]) => mockHouseById(...args),
}));

import { useMenuAccess } from './useMenuAccess';

type AuthOverrides = Record<string, unknown>;

function auth(overrides: AuthOverrides = {}) {
  const { staff: staffOverrides, ...rest } = overrides;
  return {
    staff: {
      id: 'staff-1',
      name: 'Servo X',
      houseId: 'house-1',
      user: { role: Role.SERVANT },
      ...((staffOverrides as object) ?? {}),
    },
    resident: null,
    isResident: false,
    canSendMessagesToFamilies: false,
    canModerateMessages: false,
    ...rest,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHouseById.mockReturnValue({ data: undefined });
});

describe('useMenuAccess', () => {
  it('servo com casa: nem coordenador, nem servo de grupo de apoio', () => {
    mockAuth.mockReturnValue(auth());
    const { result } = renderHook(() => useMenuAccess());

    expect(result.current.access).toEqual({
      isResident: false,
      isSupportGroupServant: false,
      isCoordinator: false,
      isHouseCoordinator: false,
      canSendMessagesToFamilies: false,
      canModerateMessages: false,
    });
    expect(result.current.menuItems.map((item) => item.key)).toContain('residents');
    expect(result.current.quickActions.map((item) => item.key)).not.toContain('census');
  });

  it('busca a casa só para coordenador e marca coordenador da própria casa', () => {
    mockAuth.mockReturnValue(auth({ staff: { user: { role: Role.COORDINATOR } } }));
    mockHouseById.mockReturnValue({ data: { id: 'house-1', coordinatorId: 'staff-1' } });

    const { result } = renderHook(() => useMenuAccess());

    expect(mockHouseById).toHaveBeenCalledWith('house-1', { enabled: true });
    expect(result.current.access.isCoordinator).toBe(true);
    expect(result.current.access.isHouseCoordinator).toBe(true);
    expect(result.current.menuItems.map((item) => item.key)).toEqual(
      expect.arrayContaining(['census', 'houseSettings']),
    );
  });

  it('coordenador de outra casa não ganha configurações da casa', () => {
    mockAuth.mockReturnValue(auth({ staff: { user: { role: Role.COORDINATOR } } }));
    mockHouseById.mockReturnValue({ data: { id: 'house-1', coordinatorId: 'outro' } });

    const { result } = renderHook(() => useMenuAccess());

    expect(result.current.access.isHouseCoordinator).toBe(false);
    expect(result.current.menuItems.map((item) => item.key)).not.toContain('houseSettings');
  });

  it('servo sem casa é servo de grupo de apoio', () => {
    mockAuth.mockReturnValue(auth({ staff: { houseId: null } }));
    const { result } = renderHook(() => useMenuAccess());

    expect(result.current.access.isSupportGroupServant).toBe(true);
    expect(mockHouseById).toHaveBeenCalledWith(null, { enabled: false });
    expect(result.current.menuItems.map((item) => item.key)).toEqual(['supportGroups']);
  });

  it('interno não dispara consulta de casa e fica só com mensagens e pedidos', () => {
    mockAuth.mockReturnValue({
      staff: null,
      resident: { id: 'resident-1', name: 'Filho X' },
      isResident: true,
      canSendMessagesToFamilies: false,
      canModerateMessages: false,
    });

    const { result } = renderHook(() => useMenuAccess());

    expect(mockHouseById).toHaveBeenCalledWith(undefined, { enabled: false });
    expect(result.current.access.isSupportGroupServant).toBe(false);
    expect(result.current.menuItems.map((item) => item.key)).toEqual([
      'messages',
      'wishlist',
    ]);
  });

  it('propaga as permissões de mensagens do useAuth', () => {
    mockAuth.mockReturnValue(auth({ canModerateMessages: true }));
    const { result } = renderHook(() => useMenuAccess());

    expect(result.current.access.canModerateMessages).toBe(true);
    expect(result.current.menuItems.map((item) => item.key)).toEqual(
      expect.arrayContaining(['messages', 'wishlist']),
    );
  });
});

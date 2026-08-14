import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

const mockPush = jest.fn();
const mockLogout = jest.fn();
const mockAuth = jest.fn();
const mockMenuAccess = jest.fn();

jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/lib/auth', () => ({ useAuth: () => mockAuth() }));
jest.mock('@/lib/api', () => ({ resolveAssetUrl: (u: string | null) => u }));
jest.mock('../hooks/useMenuAccess', () => ({ useMenuAccess: () => mockMenuAccess() }));

import { MenuPage } from './MenuPage';
import { buildMenuItems, buildQuickActions, type MenuAccess } from '../constants';

const SERVANT: MenuAccess = {
  isResident: false,
  isSupportGroupServant: false,
  isCoordinator: false,
  isHouseCoordinator: false,
  canSendMessagesToFamilies: false,
  canModerateMessages: true,
};

const RESIDENT: MenuAccess = { ...SERVANT, isResident: true, canModerateMessages: false };

function useAccess(access: MenuAccess) {
  mockMenuAccess.mockReturnValue({
    access,
    menuItems: buildMenuItems(access),
    quickActions: buildQuickActions(access),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockReturnValue({
    staff: { name: 'Servo X', house: { name: 'Casa Bethel' }, photoUrl: null },
    resident: null,
    isResident: false,
    logout: mockLogout,
  });
  useAccess(SERVANT);
});

describe('MenuPage', () => {
  it('mostra o cabeçalho com o usuário logado e o botão de editar perfil', () => {
    render(<MenuPage />);

    expect(screen.getByText('Servo X')).toBeTruthy();
    expect(screen.getByText('Casa Bethel')).toBeTruthy();

    fireEvent.press(screen.getByTestId('menu-edit-profile'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/profile');
  });

  it('agrupa os itens permitidos em seções e navega em cada linha', () => {
    render(<MenuPage />);

    expect(screen.getByText('Casa')).toBeTruthy();
    expect(screen.getByText('Estoque')).toBeTruthy();
    expect(screen.getByText('Comunicação')).toBeTruthy();
    expect(screen.getByText('Conta')).toBeTruthy();

    fireEvent.press(screen.getByTestId('menu-item-residents'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/residents');

    fireEvent.press(screen.getByTestId('menu-item-storeroom'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/storeroom');

    fireEvent.press(screen.getByTestId('menu-item-sync'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/sync');
  });

  it('não mostra item que o perfil não pode abrir', () => {
    render(<MenuPage />);

    expect(screen.queryByTestId('menu-item-census')).toBeNull();
    expect(screen.queryByTestId('menu-item-houseSettings')).toBeNull();
    expect(screen.queryByTestId('menu-item-supportGroups')).toBeNull();
  });

  it('sai pelo menu, com o aviso de perda da fila junto', () => {
    render(<MenuPage />);

    expect(screen.getByTestId('sync-logout-notice')).toBeTruthy();
    fireEvent.press(screen.getByTestId('menu-item-logout'));
    expect(mockLogout).toHaveBeenCalled();
  });

  it('interno: sem seções de casa e estoque, mas com Conta para poder sair', () => {
    mockAuth.mockReturnValue({
      staff: null,
      resident: { name: 'Filho X', photoUrl: null },
      isResident: true,
      logout: mockLogout,
    });
    useAccess(RESIDENT);

    render(<MenuPage />);

    // Seção vazia não deixa título órfão na tela.
    expect(screen.queryByText('Casa')).toBeNull();
    expect(screen.queryByText('Estoque')).toBeNull();
    expect(screen.getByText('Comunicação')).toBeTruthy();
    expect(screen.getByText('Conta')).toBeTruthy();
    expect(screen.getByTestId('menu-item-messages')).toBeTruthy();
    expect(screen.getByTestId('menu-item-logout')).toBeTruthy();
    expect(screen.queryByTestId('menu-item-sync')).toBeNull();
  });
});

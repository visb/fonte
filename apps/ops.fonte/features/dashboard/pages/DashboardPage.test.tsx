import { ScrollView } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

const mockPush = jest.fn();
const mockAuth = jest.fn();
const mockMenuAccess = jest.fn();
const mockResidentCount = jest.fn();
const mockHouseStaff = jest.fn();

jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/lib/auth', () => ({ useAuth: () => mockAuth() }));
jest.mock('@/features/menu/hooks/useMenuAccess', () => ({
  useMenuAccess: () => mockMenuAccess(),
}));
jest.mock('@/features/residents/hooks/useResidents', () => ({
  useResidentCountByHouse: (...a: unknown[]) => mockResidentCount(...a),
}));
jest.mock('@/features/staff/hooks/useHouseStaff', () => ({
  useHouseStaff: (...a: unknown[]) => mockHouseStaff(...a),
}));
// Cabeçalho e fila de envio têm testes próprios; aqui só atrapalhariam.
jest.mock('@/features/dashboard/components/WelcomeHeader', () => ({ WelcomeHeader: () => null }));
jest.mock('@/features/sync/components/SyncQueueBadge', () => ({ SyncQueueBadge: () => null }));

import { DashboardPage } from './DashboardPage';
import {
  buildQuickActions,
  canAccessMenuItem,
  menuItemRoute,
  type MenuAccess,
  type MenuItemKey,
} from '@/features/menu/constants';

const SERVANT: MenuAccess = {
  isResident: false,
  isSupportGroupServant: false,
  isCoordinator: false,
  isHouseCoordinator: false,
  canSendMessagesToFamilies: false,
  canModerateMessages: false,
};
const RESIDENT: MenuAccess = { ...SERVANT, isResident: true };

const refetchResidents = jest.fn().mockResolvedValue(undefined);
const refetchStaff = jest.fn().mockResolvedValue(undefined);

function useAccess(access: MenuAccess) {
  mockMenuAccess.mockReturnValue({
    access,
    quickActions: buildQuickActions(access),
    canAccess: (key: MenuItemKey) => canAccessMenuItem(key, access),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockReturnValue({ staff: { name: 'Servo X', houseId: 'h1', house: { name: 'Casa' } } });
  useAccess(SERVANT);
  mockResidentCount.mockReturnValue({
    data: [
      { id: 'r1', status: 'ACTIVE' },
      { id: 'r2', status: 'ACTIVE' },
      { id: 'r3', status: 'ARCHIVED' },
    ],
    refetch: refetchResidents,
  });
  mockHouseStaff.mockReturnValue({
    data: [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }],
    refetch: refetchStaff,
  });
});

describe('DashboardPage (story 221)', () => {
  it('conta os filhos presentes e os servos da lista da casa', () => {
    render(<DashboardPage />);

    expect(mockHouseStaff).toHaveBeenCalledWith('h1');
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('Servos na casa')).toBeTruthy();
    expect(screen.queryByText('Ocorrências hoje')).toBeNull();
  });

  it('tocar no card de filhos abre a lista de filhos do catálogo', () => {
    render(<DashboardPage />);
    fireEvent.press(screen.getByRole('button', { name: 'Ver filhos' }));
    expect(mockPush).toHaveBeenCalledWith(menuItemRoute('residents'));
  });

  it('tocar no card de servos abre a lista de servos do catálogo', () => {
    render(<DashboardPage />);
    fireEvent.press(screen.getByRole('button', { name: 'Ver servos' }));
    expect(mockPush).toHaveBeenCalledWith(menuItemRoute('staff'));
  });

  it('perfil sem acesso às listas (interno) vê os cards sem toque', () => {
    useAccess(RESIDENT);
    render(<DashboardPage />);

    expect(screen.getByTestId('stat-card-residents')).toBeTruthy();
    expect(screen.getByTestId('stat-card-staff')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ver filhos' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver servos' })).toBeNull();
  });

  it('sem dados ainda mostra zero nos dois cards', () => {
    mockResidentCount.mockReturnValue({ data: undefined, refetch: refetchResidents });
    mockHouseStaff.mockReturnValue({ data: undefined, refetch: refetchStaff });
    render(<DashboardPage />);
    expect(screen.getAllByText('0')).toHaveLength(2);
  });

  it('sem servo logado (interno) não consulta casa nenhuma', () => {
    mockAuth.mockReturnValue({ staff: null });
    useAccess(RESIDENT);
    render(<DashboardPage />);
    expect(mockHouseStaff).toHaveBeenCalledWith(undefined);
    expect(mockResidentCount).toHaveBeenCalledWith(undefined);
  });

  it('pull-to-refresh refaz filhos e servos', async () => {
    render(<DashboardPage />);
    const refreshControl = screen.UNSAFE_getByType(ScrollView).props.refreshControl;

    await act(async () => {
      await refreshControl.props.onRefresh();
    });

    expect(refetchResidents).toHaveBeenCalledTimes(1);
    expect(refetchStaff).toHaveBeenCalledTimes(1);
  });
});

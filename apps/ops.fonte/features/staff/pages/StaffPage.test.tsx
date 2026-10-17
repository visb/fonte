import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Role } from '@fonte/types';

const mockAuth = jest.fn();
const mockHouseStaff = jest.fn();

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));
jest.mock('@/lib/auth', () => ({ useAuth: () => mockAuth() }));
jest.mock('@/lib/api', () => ({ api: {}, resolveAssetUrl: (u: string | null) => u }));
jest.mock('@/features/staff/hooks/useHouseStaff', () => ({
  useHouseStaff: (...args: unknown[]) => mockHouseStaff(...args),
}));

import { StaffPage } from './StaffPage';

const STAFF = [
  { id: 's3', name: 'Zeca', role: Role.SERVANT, whatsapp: '62999990000', photoUrl: null, ledMinistries: [] },
  { id: 's1', name: 'Bruno', role: Role.COORDINATOR, whatsapp: null, photoUrl: null, ledMinistries: [] },
  { id: 's2', name: 'Ana', role: Role.SERVANT, whatsapp: '62988880000', photoUrl: null, ledMinistries: [] },
];

function setup(query: Record<string, unknown>, houseId: string | null = 'h1') {
  mockAuth.mockReturnValue({ staff: { id: 's2', houseId, user: { role: Role.SERVANT } } });
  mockHouseStaff.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: jest.fn(), ...query });
  return render(<StaffPage />);
}

beforeEach(() => jest.clearAllMocks());

describe('StaffPage', () => {
  it('loading usa o LoadingState do app', () => {
    setup({ isLoading: true });
    expect(screen.queryByText('Nenhum servo nesta casa.')).toBeNull();
    expect(screen.queryByText('Zeca')).toBeNull();
  });

  it('vazio usa o EmptyState', () => {
    setup({ data: [] });
    expect(screen.getByText('Nenhum servo nesta casa.')).toBeTruthy();
  });

  it('erro sem dado em cache usa o ErrorState com tentar de novo', () => {
    const refetch = jest.fn();
    setup({ error: new Error('x'), refetch });
    expect(screen.getByText('Erro ao carregar dados.')).toBeTruthy();
    fireEvent.press(screen.getByText('Tentar novamente'));
    expect(refetch).toHaveBeenCalled();
  });

  it('erro com dado em cache (offline) segue mostrando a lista', () => {
    setup({ data: STAFF, error: new Error('Network Error') });
    expect(screen.queryByText('Erro ao carregar dados.')).toBeNull();
    expect(screen.getByText('Zeca')).toBeTruthy();
  });

  it('ordena coordenadores → servos → nome e marca o usuário logado', () => {
    setup({ data: STAFF });
    const rows = screen.getAllByTestId(/^staff-row-/).map((row) => row.props.testID);
    expect(rows).toEqual(['staff-row-s1', 'staff-row-s2', 'staff-row-s3']);
    expect(screen.getByText(/\(você\)/)).toBeTruthy();
    // O próprio usuário (Ana) não ganha botão; o Zeca, sim.
    expect(screen.queryByLabelText('WhatsApp de Ana')).toBeNull();
    expect(screen.getByLabelText('WhatsApp de Zeca')).toBeTruthy();
    expect(mockHouseStaff).toHaveBeenCalledWith('h1');
  });

  it('puxar para atualizar refaz a query', async () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    setup({ data: STAFF, refetch });
    const list = screen.UNSAFE_getByType(require('react-native').FlatList);
    await act(async () => {
      await list.props.onRefresh();
    });
    expect(refetch).toHaveBeenCalled();
  });

  it('sem casa (servo de grupo de apoio) não consulta e avisa', () => {
    setup({}, null);
    expect(mockHouseStaff).toHaveBeenCalledWith(null);
    expect(screen.getByText('Você não está lotado em uma casa.')).toBeTruthy();
  });
});

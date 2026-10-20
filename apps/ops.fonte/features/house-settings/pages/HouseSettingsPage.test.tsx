import { fireEvent, render, screen } from '@testing-library/react-native';
import { Role } from '@fonte/types';

const mockAuth = jest.fn();
const mockHouseById = jest.fn();

jest.mock('@/lib/auth', () => ({ useAuth: () => mockAuth() }));
jest.mock('../hooks/useHouseSettings', () => ({
  useHouseById: (...args: unknown[]) => mockHouseById(...args),
}));
jest.mock('../components/BedCapacityForm', () => {
  const { Text } = require('react-native');
  return { BedCapacityForm: () => <Text>Leitos</Text> };
});
jest.mock('../components/HousePhotoGallery', () => {
  const { Text } = require('react-native');
  return { HousePhotoGallery: () => <Text>Fotos</Text> };
});

import { HouseSettingsPage } from './HouseSettingsPage';

const HOUSE = { id: 'house-1', name: 'Casa Teste', coordinatorId: 'staff-titular' };
const BLOCKED = 'Apenas o coordenador da casa pode acessar as configurações.';

function staff(overrides: Record<string, unknown> = {}) {
  return {
    id: 'staff-1',
    houseId: 'house-1',
    user: { role: Role.COORDINATOR },
    ...overrides,
  };
}

function setup(options: { staff?: unknown; house?: unknown } = {}) {
  mockAuth.mockReturnValue({ staff: options.staff ?? staff() });
  mockHouseById.mockReturnValue({
    data: 'house' in options ? options.house : HOUSE,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });
  return render(<HouseSettingsPage />);
}

beforeEach(() => jest.clearAllMocks());

describe('HouseSettingsPage — gate de acesso (story 194)', () => {
  // A regressão que a decisão 4 exige: dos N coordenadores da casa, todos
  // configuram a casa — o titular não tem permissão extra.
  it('coordenador NÃO titular lotado na casa entra', () => {
    setup();

    expect(screen.queryByText(BLOCKED)).toBeNull();
    expect(screen.getByText('Leitos')).toBeTruthy();
    expect(screen.getByText('Fotos')).toBeTruthy();
  });

  it('coordenador titular continua entrando', () => {
    setup({ staff: staff({ id: 'staff-titular' }) });

    expect(screen.queryByText(BLOCKED)).toBeNull();
    expect(screen.getByText('Leitos')).toBeTruthy();
  });

  it('casa sem titular nenhum não barra o coordenador lotado', () => {
    setup({ house: { ...HOUSE, coordinatorId: null } });

    expect(screen.queryByText(BLOCKED)).toBeNull();
  });

  it('coordenador de outra casa continua barrado', () => {
    setup({ staff: staff({ houseId: 'house-9' }) });

    expect(screen.getByText(BLOCKED)).toBeTruthy();
  });

  // Story 214: ADMIN lotado na casa é coordenador dela.
  it('ADMIN lotado na casa entra (story 214)', () => {
    setup({ staff: staff({ user: { role: Role.ADMIN } }) });

    expect(screen.queryByText(BLOCKED)).toBeNull();
    expect(screen.getByText('Leitos')).toBeTruthy();
  });

  it('ADMIN de outra casa continua barrado (story 214)', () => {
    setup({ staff: staff({ houseId: 'house-9', user: { role: Role.ADMIN } }) });

    expect(screen.getByText(BLOCKED)).toBeTruthy();
  });

  it('SERVANT da própria casa continua barrado', () => {
    setup({ staff: staff({ user: { role: Role.SERVANT } }) });

    expect(screen.getByText(BLOCKED)).toBeTruthy();
  });

  it('sem casa carregada mostra o empty state de casa não encontrada', () => {
    setup({ house: undefined });

    expect(screen.getByText('Casa não encontrada.')).toBeTruthy();
  });

  it('enquanto carrega não decide o gate', () => {
    mockAuth.mockReturnValue({ staff: staff() });
    mockHouseById.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    render(<HouseSettingsPage />);

    expect(screen.queryByText(BLOCKED)).toBeNull();
    expect(screen.queryByText('Leitos')).toBeNull();
  });

  it('erro de carga mostra o ErrorState e "Tentar novamente" refaz a consulta', () => {
    const refetch = jest.fn();
    mockAuth.mockReturnValue({ staff: staff() });
    mockHouseById.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('offline'),
      refetch,
    });

    render(<HouseSettingsPage />);

    expect(screen.queryByText('Leitos')).toBeNull();
    fireEvent.press(screen.getByText('Tentar novamente'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

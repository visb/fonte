import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

const mockPush = jest.fn();
const mockLogout = jest.fn();
const mockAuth = jest.fn();

jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/lib/auth', () => ({ useAuth: () => mockAuth() }));
jest.mock('@/lib/api', () => ({ resolveAssetUrl: (u: string | null) => u }));

import { MenuRow } from './MenuRow';
import { MenuSection } from './MenuSection';
import { MenuProfileCard } from './MenuProfileCard';
import { MenuLogoutRow } from './MenuLogoutRow';
import { MENU_ITEMS } from '../constants';

const residentsItem = MENU_ITEMS.find((item) => item.key === 'residents')!;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockReturnValue({
    staff: { name: 'Servo X', house: { name: 'Casa Bethel' }, photoUrl: null },
    resident: null,
    isResident: false,
    logout: mockLogout,
  });
});

describe('MenuRow', () => {
  it('mostra o rótulo com testID estável e navega para a rota do item', () => {
    render(<MenuRow item={residentsItem} />);

    expect(screen.getByText('Filhos')).toBeTruthy();
    expect(screen.getByText('icon:chevron-forward')).toBeTruthy();
    fireEvent.press(screen.getByTestId('menu-item-residents'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/residents');
  });
});

describe('MenuSection', () => {
  it('mostra o título e os filhos', () => {
    render(
      <MenuSection label="Casa">
        <MenuRow item={residentsItem} />
      </MenuSection>,
    );

    expect(screen.getByText('Casa')).toBeTruthy();
    expect(screen.getByText('Filhos')).toBeTruthy();
  });
});

describe('MenuProfileCard', () => {
  it('mostra nome e casa do servo e leva para o perfil', () => {
    render(<MenuProfileCard />);

    expect(screen.getByText('Servo X')).toBeTruthy();
    expect(screen.getByText('Casa Bethel')).toBeTruthy();
    // Sem foto cai no placeholder de pessoa.
    expect(screen.getByText('icon:person')).toBeTruthy();

    fireEvent.press(screen.getByTestId('menu-edit-profile'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/profile');
  });

  it('com foto renderiza a imagem em vez do placeholder', () => {
    mockAuth.mockReturnValue({
      staff: { name: 'Servo X', house: { name: 'Casa Bethel' }, photoUrl: '/uploads/x.jpg' },
      resident: null,
      isResident: false,
      logout: mockLogout,
    });

    render(<MenuProfileCard />);

    expect(screen.getByTestId('menu-profile-photo')).toBeTruthy();
    expect(screen.queryByText('icon:person')).toBeNull();
  });

  it('servo de grupo de apoio mostra o nome do grupo como subtítulo', () => {
    mockAuth.mockReturnValue({
      staff: { name: 'Servo Y', supportGroup: { name: 'Grupo Esperança' }, photoUrl: null },
      resident: null,
      isResident: false,
      logout: mockLogout,
    });

    render(<MenuProfileCard />);

    expect(screen.getByText('Grupo Esperança')).toBeTruthy();
  });

  it('interno mostra o próprio nome e o subtítulo "Filho"', () => {
    mockAuth.mockReturnValue({
      staff: null,
      resident: { name: 'Filho X', photoUrl: null },
      isResident: true,
      logout: mockLogout,
    });

    render(<MenuProfileCard />);

    expect(screen.getByText('Filho X')).toBeTruthy();
    expect(screen.getByText('Filho')).toBeTruthy();
  });

  it('sem usuário carregado não quebra', () => {
    mockAuth.mockReturnValue({
      staff: null,
      resident: null,
      isResident: false,
      logout: mockLogout,
    });

    render(<MenuProfileCard />);

    expect(screen.getByText('—')).toBeTruthy();
  });
});

describe('MenuLogoutRow', () => {
  it('dispara logout e mantém o aviso de fila do logout à vista', () => {
    render(<MenuLogoutRow />);

    expect(screen.getByTestId('sync-logout-notice')).toBeTruthy();
    fireEvent.press(screen.getByTestId('menu-item-logout'));
    expect(mockLogout).toHaveBeenCalled();
  });
});

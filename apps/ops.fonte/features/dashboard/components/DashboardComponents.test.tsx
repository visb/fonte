import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
const mockPush = jest.fn();
const mockLogout = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ logout: mockLogout }) }));
jest.mock('@/lib/api', () => ({ resolveAssetUrl: (u: string | null) => u }));
// NotificationBell tem hooks/socket — stub para isolar o WelcomeHeader.
jest.mock('@/features/notifications/components/NotificationBell', () => ({
  NotificationBell: () => null,
}));

import { StatCards } from './StatCards';
import { QuickActions } from './QuickActions';
import { WelcomeHeader } from './WelcomeHeader';

beforeEach(() => jest.clearAllMocks());

describe('StatCards', () => {
  it('mostra contagens de filhos e ocorrências', () => {
    render(<StatCards residentCount={12} incidentCount={3} />);
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('Filhos na casa')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('Ocorrências hoje')).toBeTruthy();
  });
});

describe('QuickActions', () => {
  it('mostra as ações base e navega ao tocar', () => {
    render(<QuickActions />);
    expect(screen.getByText('Nova ocorrência')).toBeTruthy();
    expect(screen.getByText('Faturamento')).toBeTruthy();
    expect(screen.queryByText('Configurações da casa')).toBeNull();
    fireEvent.press(screen.getByText('Atividades'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/activities');
  });

  it('com showHouseSettings inclui ações de coordenador', () => {
    render(<QuickActions showHouseSettings />);
    expect(screen.getByText('Contagem')).toBeTruthy();
    expect(screen.getByText('Configurações da casa')).toBeTruthy();
  });
});

describe('WelcomeHeader', () => {
  it('mostra nome, casa e dispara logout', () => {
    render(<WelcomeHeader name="Servo X" houseName="Casa Bethel" />);
    expect(screen.getByText('Servo X')).toBeTruthy();
    expect(screen.getByText('Casa Bethel')).toBeTruthy();
    fireEvent.press(screen.getByText('Sair'));
    expect(mockLogout).toHaveBeenCalled();
  });

  it('sem foto mostra o ícone de pessoa', () => {
    render(<WelcomeHeader name="Servo X" />);
    expect(screen.getByText('icon:person')).toBeTruthy();
  });
});

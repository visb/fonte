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
// NotificationBell tem hooks/socket — stub para isolar o WelcomeHeader, mas
// visível: o sino continua no cabeçalho depois que o "Sair" saiu (story 176).
jest.mock('@/features/notifications/components/NotificationBell', () => {
  const { Text } = require('react-native');
  return { NotificationBell: () => <Text>sino-notificacoes</Text> };
});

import { StatCards } from './StatCards';
import { QuickActions } from './QuickActions';
import { WelcomeHeader } from './WelcomeHeader';
import { buildQuickActions, type MenuAccess } from '@/features/menu/constants';

const SERVANT: MenuAccess = {
  isResident: false,
  isSupportGroupServant: false,
  isCoordinator: false,
  isHouseCoordinator: false,
  canSendMessagesToFamilies: false,
  canModerateMessages: false,
};

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
  // Os atalhos agora vêm do catálogo único (story 176); estes casos travam os
  // rótulos de hoje contra regressão silenciosa do dashboard.
  it('mostra as ações base e navega ao tocar', () => {
    render(<QuickActions items={buildQuickActions(SERVANT)} />);
    expect(screen.getByText('Nova ocorrência')).toBeTruthy();
    expect(screen.getByText('Ver filhos')).toBeTruthy();
    expect(screen.getByText('Faturamento')).toBeTruthy();
    expect(screen.queryByText('Contagem')).toBeNull();
    expect(screen.queryByText('Configurações da casa')).toBeNull();
    fireEvent.press(screen.getByText('Atividades'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/activities');
  });

  it('coordenador inclui contagem sem configurações da casa', () => {
    render(<QuickActions items={buildQuickActions({ ...SERVANT, isCoordinator: true })} />);
    expect(screen.getByText('Contagem')).toBeTruthy();
    expect(screen.queryByText('Configurações da casa')).toBeNull();
  });

  it('coordenador da própria casa inclui configurações da casa', () => {
    render(
      <QuickActions
        items={buildQuickActions({
          ...SERVANT,
          isCoordinator: true,
          isHouseCoordinator: true,
        })}
      />,
    );
    expect(screen.getByText('Contagem')).toBeTruthy();
    expect(screen.getByText('Configurações da casa')).toBeTruthy();
  });

  it('sem atalho permitido não renderiza nem o título da seção', () => {
    render(<QuickActions items={[]} />);
    expect(screen.queryByText('Ações rápidas')).toBeNull();
  });
});

describe('WelcomeHeader', () => {
  it('mostra nome e casa, sem o botão Sair (foi para o menu)', () => {
    render(<WelcomeHeader name="Servo X" houseName="Casa Bethel" />);
    expect(screen.getByText('Servo X')).toBeTruthy();
    expect(screen.getByText('Casa Bethel')).toBeTruthy();
    expect(screen.queryByText('Sair')).toBeNull();
    expect(mockLogout).not.toHaveBeenCalled();
    expect(screen.getByText('sino-notificacoes')).toBeTruthy();
  });

  it('sem foto mostra o ícone de pessoa', () => {
    render(<WelcomeHeader name="Servo X" />);
    expect(screen.getByText('icon:person')).toBeTruthy();
  });
});

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

import { StatCard } from './StatCard';
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

describe('StatCard', () => {
  it('com onPress é botão, mostra o chevron e dispara o callback', () => {
    const onPress = jest.fn();
    render(
      <StatCard testID="card" value={7} label="Filhos na casa" accessibilityLabel="Ver filhos" onPress={onPress} />,
    );
    const button = screen.getByRole('button', { name: 'Ver filhos' });
    expect(screen.getByText('icon:chevron-forward')).toBeTruthy();
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('sem onPress não é botão nem mostra o chevron', () => {
    render(<StatCard testID="card" value={7} label="Filhos na casa" accessibilityLabel="Ver filhos" />);
    expect(screen.getByTestId('card')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('icon:chevron-forward')).toBeNull();
  });
});

describe('StatCards', () => {
  // Story 221: "Ocorrências hoje" deu lugar ao contador de servos.
  it('mostra contagens de filhos e servos, sem ocorrências do dia', () => {
    render(<StatCards residentCount={12} staffCount={3} />);
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('Filhos na casa')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('Servos na casa')).toBeTruthy();
    expect(screen.queryByText('Ocorrências hoje')).toBeNull();
    expect(screen.getByTestId('stat-card-residents')).toBeTruthy();
    expect(screen.getByTestId('stat-card-staff')).toBeTruthy();
  });

  it('cada card toca o seu callback', () => {
    const onPressResidents = jest.fn();
    const onPressStaff = jest.fn();
    render(
      <StatCards
        residentCount={12}
        staffCount={3}
        onPressResidents={onPressResidents}
        onPressStaff={onPressStaff}
      />,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Ver filhos' }));
    fireEvent.press(screen.getByRole('button', { name: 'Ver servos' }));
    expect(onPressResidents).toHaveBeenCalledTimes(1);
    expect(onPressStaff).toHaveBeenCalledTimes(1);
  });
});

describe('QuickActions', () => {
  // Os atalhos agora vêm do catálogo único (story 176); estes casos travam os
  // rótulos de hoje contra regressão silenciosa do dashboard.
  it('mostra as ações base e navega ao tocar', () => {
    render(<QuickActions items={buildQuickActions(SERVANT)} />);
    expect(screen.getByText('Nova ocorrência')).toBeTruthy();
    expect(screen.getByText('Ver filhos')).toBeTruthy();
    // Faturamento escondido por ora (vai voltar).
    expect(screen.queryByText('Faturamento')).toBeNull();
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

  // Story 207: nível do servo logado.
  it('servo com nível mostra o badge; sem nível, não', () => {
    render(<WelcomeHeader name="Servo X" rank={'ALIANCADO' as never} />);
    expect(screen.getByText('Aliançado')).toBeTruthy();
    screen.unmount();
    render(<WelcomeHeader name="Coord" rank={null} />);
    expect(screen.queryByTestId(/^servant-rank-/)).toBeNull();
  });
});

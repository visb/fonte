import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/lib/test/utils';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

// Hooks de notificação mockados (NotificationBell/Sheet usam socket + queries).
const mockUseUnreadCount = jest.fn();
const mockUseNotifications = jest.fn();
const mockMarkRead = jest.fn();
const mockMarkAllRead = jest.fn();
jest.mock('../hooks/useNotifications', () => ({
  useUnreadCount: () => mockUseUnreadCount(),
  useNotificationSocket: jest.fn(),
  useNotifications: () => mockUseNotifications(),
  useMarkNotificationRead: () => ({ mutate: mockMarkRead }),
  useMarkAllNotificationsRead: () => ({ mutate: mockMarkAllRead, isPending: false }),
}));

import { NotificationRow } from './NotificationRow';
import { NotificationBell } from './NotificationBell';
import { NotificationsSheet } from './NotificationsSheet';

function rc(ui: React.ReactElement) {
  return render(<QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseUnreadCount.mockReturnValue({ data: 0 });
  mockUseNotifications.mockReturnValue({ data: [], isLoading: false, error: null });
});

describe('NotificationRow', () => {
  const base = { id: 'n1', title: 'Nova mensagem', body: 'Veja agora', read: false, createdAt: new Date().toISOString() };

  it('não lida mostra o botão de marcar como lida e dispara onMarkRead', () => {
    const onMarkRead = jest.fn();
    render(<NotificationRow item={base as never} onPress={jest.fn()} onMarkRead={onMarkRead} />);
    expect(screen.getByText('Nova mensagem')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Marcar como lida'));
    expect(onMarkRead).toHaveBeenCalledWith('n1');
  });

  it('lida não mostra o botão de marcar; tocar dispara onPress', () => {
    const onPress = jest.fn();
    render(<NotificationRow item={{ ...base, read: true } as never} onPress={onPress} onMarkRead={jest.fn()} />);
    expect(screen.queryByLabelText('Marcar como lida')).toBeNull();
    fireEvent.press(screen.getByText('Nova mensagem'));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('NotificationBell', () => {
  it('sem não-lidas não mostra o badge', () => {
    mockUseUnreadCount.mockReturnValue({ data: 0 });
    rc(<NotificationBell />);
    expect(screen.getByTestId('notification-bell')).toBeTruthy();
    expect(screen.queryByTestId('notification-badge')).toBeNull();
  });

  it('com não-lidas mostra o contador; > 99 vira "99+"', () => {
    mockUseUnreadCount.mockReturnValue({ data: 150 });
    rc(<NotificationBell />);
    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('abre a sheet ao tocar no sino', () => {
    mockUseUnreadCount.mockReturnValue({ data: 3 });
    rc(<NotificationBell />);
    expect(screen.getByText('3')).toBeTruthy();
    fireEvent.press(screen.getByTestId('notification-bell'));
    expect(screen.getByText('Notificações')).toBeTruthy();
  });
});

describe('NotificationsSheet', () => {
  it('vazio mostra EmptyState', () => {
    mockUseNotifications.mockReturnValue({ data: [], isLoading: false, error: null });
    rc(<NotificationsSheet visible onClose={jest.fn()} />);
    expect(screen.getByText('Nenhuma notificação')).toBeTruthy();
  });

  it('erro mostra ErrorState', () => {
    mockUseNotifications.mockReturnValue({ data: [], isLoading: false, error: { message: 'falhou' } });
    rc(<NotificationsSheet visible onClose={jest.fn()} />);
    expect(screen.getByText(/falhou|Erro ao carregar/)).toBeTruthy();
  });

  it('lista notificações e "marcar todas" dispara a mutation', () => {
    mockUseNotifications.mockReturnValue({
      data: [{ id: 'n1', title: 'Aviso', body: null, read: false, createdAt: new Date().toISOString() }],
      isLoading: false,
      error: null,
    });
    rc(<NotificationsSheet visible onClose={jest.fn()} />);
    expect(screen.getByText('Aviso')).toBeTruthy();
    fireEvent.press(screen.getByText('Marcar todas como lidas'));
    expect(mockMarkAllRead).toHaveBeenCalled();
  });
});

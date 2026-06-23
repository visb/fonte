import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

const notifState = { data: [] as unknown[], isLoading: false, error: null as unknown };
const markRead = { mutate: vi.fn() };
const markAllRead = { mutate: vi.fn(), isPending: false };
vi.mock('../hooks/useNotifications', () => ({
  useNotifications: () => notifState,
  useMarkNotificationRead: () => markRead,
  useMarkAllNotificationsRead: () => markAllRead,
}));
vi.mock('./NotificationItem', () => ({
  NotificationItem: ({ notification, onSelect }: { notification: { id: string; title: string }; onSelect: (n: unknown) => void }) => (
    <button onClick={() => onSelect(notification)}>item-{notification.id}</button>
  ),
}));

import { NotificationsPanel } from './NotificationsPanel';

beforeEach(() => {
  vi.clearAllMocks();
  notifState.data = [];
  notifState.isLoading = false;
  notifState.error = null;
});
afterEach(() => cleanup());

describe('NotificationsPanel', () => {
  it('loading mostra carregamento', () => {
    notifState.isLoading = true;
    const { container } = render(<NotificationsPanel onClose={vi.fn()} />);
    expect(container.textContent).toContain('Notificações');
  });

  it('erro mostra ErrorState', () => {
    notifState.error = new Error('boom');
    render(<NotificationsPanel onClose={vi.fn()} />);
    expect(screen.getByText(/Erro ao carregar notificações|boom/)).toBeInTheDocument();
  });

  it('vazio mostra empty state e botão "marcar todas" desabilitado', () => {
    render(<NotificationsPanel onClose={vi.fn()} />);
    expect(screen.getByText('Nenhuma notificação')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Marcar todas como lidas/ })).toBeDisabled();
  });

  it('selecionar notificação não lida marca como lida, fecha e navega', () => {
    const onClose = vi.fn();
    notifState.data = [{ id: 'n1', title: 'Aviso', read: false, link: '/x' }];
    render(<NotificationsPanel onClose={onClose} />);
    fireEvent.click(screen.getByText('item-n1'));
    expect(markRead.mutate).toHaveBeenCalledWith('n1');
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/x');
  });

  it('marcar todas como lidas dispara a mutation', () => {
    notifState.data = [{ id: 'n1', title: 'Aviso', read: false }];
    render(<NotificationsPanel onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Marcar todas como lidas/ }));
    expect(markAllRead.mutate).toHaveBeenCalled();
  });

  it('"Ver todas" fecha e navega para /notifications', () => {
    const onClose = vi.fn();
    render(<NotificationsPanel onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas' }));
    expect(onClose).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/notifications');
  });
});

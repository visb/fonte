import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { NotificationType, type Notification } from '@fonte/api-client';

vi.mock('./CapacityRequestActions', () => ({
  CapacityRequestActions: () => <div data-testid="capacity-actions" />,
}));
vi.mock('./CensusReviewActions', () => ({
  CensusReviewActions: () => <div data-testid="census-actions" />,
}));

import { NotificationItem } from './NotificationItem';

function notif(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    type: NotificationType.PAYMENT_REGISTERED,
    title: 'Nova mensagem',
    body: 'Há uma mensagem para revisar',
    read: false,
    createdAt: new Date().toISOString(),
    metadata: {},
    ...overrides,
  } as Notification;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('NotificationItem', () => {
  it('mostra título, corpo e botão de marcar como lida quando não lida', () => {
    render(<NotificationItem notification={notif()} onSelect={vi.fn()} onMarkRead={vi.fn()} />);
    expect(screen.getByText('Nova mensagem')).toBeInTheDocument();
    expect(screen.getByText('Há uma mensagem para revisar')).toBeInTheDocument();
    expect(screen.getByLabelText('Marcar como lida')).toBeInTheDocument();
  });

  it('não mostra botão de marcar como lida quando já lida', () => {
    render(<NotificationItem notification={notif({ read: true })} onSelect={vi.fn()} onMarkRead={vi.fn()} />);
    expect(screen.queryByLabelText('Marcar como lida')).not.toBeInTheDocument();
  });

  it('dispara onSelect ao clicar e onMarkRead no botão', () => {
    const onSelect = vi.fn();
    const onMarkRead = vi.fn();
    render(<NotificationItem notification={notif()} onSelect={onSelect} onMarkRead={onMarkRead} />);
    fireEvent.click(screen.getByText('Nova mensagem'));
    expect(onSelect).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Marcar como lida'));
    expect(onMarkRead).toHaveBeenCalledWith('n1');
  });

  it('embute ações de capacidade para CAPACITY_CHANGE_REQUESTED', () => {
    render(
      <NotificationItem
        notification={notif({ type: NotificationType.CAPACITY_CHANGE_REQUESTED })}
        onSelect={vi.fn()}
        onMarkRead={vi.fn()}
      />,
    );
    expect(screen.getByTestId('capacity-actions')).toBeInTheDocument();
  });

  it('embute ações de censo para CENSUS_CONCLUDED', () => {
    render(
      <NotificationItem
        notification={notif({ type: NotificationType.CENSUS_CONCLUDED })}
        onSelect={vi.fn()}
        onMarkRead={vi.fn()}
      />,
    );
    expect(screen.getByTestId('census-actions')).toBeInTheDocument();
  });
});

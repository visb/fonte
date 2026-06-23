import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { HouseCapacityRequestStatus, type Notification } from '@fonte/api-client';

const approve = { mutateAsync: vi.fn(), isPending: false, error: null as unknown };
const reject = { mutateAsync: vi.fn(), isPending: false, error: null as unknown };
const markRead = { mutate: vi.fn() };
const requestState = { data: undefined as unknown };

vi.mock('@/features/houses/hooks/useHouses', () => ({
  useApproveCapacityRequest: () => approve,
  useRejectCapacityRequest: () => reject,
  useCapacityRequest: () => requestState,
}));
vi.mock('../hooks/useNotifications', () => ({ useMarkNotificationRead: () => markRead }));

import { CapacityRequestActions } from './CapacityRequestActions';

function notif(over: Partial<Notification> = {}): Notification {
  return {
    id: 'n1', read: false,
    metadata: { requestId: 'req1', requestedGeneralCapacity: 12, requestedStaffCapacity: 3, previousGeneralCapacity: 10, previousStaffCapacity: 2 },
    ...over,
  } as unknown as Notification;
}

beforeEach(() => {
  vi.clearAllMocks();
  approve.mutateAsync = vi.fn().mockResolvedValue({});
  reject.mutateAsync = vi.fn().mockResolvedValue({});
  approve.error = null;
  reject.error = null;
  requestState.data = { status: HouseCapacityRequestStatus.PENDING };
});
afterEach(() => cleanup());

describe('CapacityRequestActions', () => {
  it('sem requestId não renderiza', () => {
    const { container } = render(<CapacityRequestActions notification={notif({ metadata: {} } as Partial<Notification>)} />);
    expect(container.firstChild).toBeNull();
  });

  it('mostra capacidades pedidas e anteriores', () => {
    render(<CapacityRequestActions notification={notif()} />);
    expect(screen.getByText(/era 10/)).toBeInTheDocument();
    expect(screen.getByText(/era 2/)).toBeInTheDocument();
  });

  it('pendente mostra Aprovar/Rejeitar; aprovar muta e marca como lido', async () => {
    render(<CapacityRequestActions notification={notif()} />);
    fireEvent.click(screen.getByRole('button', { name: /Aprovar/ }));
    await waitFor(() => expect(approve.mutateAsync).toHaveBeenCalledWith('req1'));
    expect(markRead.mutate).toHaveBeenCalledWith('n1');
  });

  it('rejeitar muta o reject', async () => {
    render(<CapacityRequestActions notification={notif()} />);
    fireEvent.click(screen.getByRole('button', { name: /Rejeitar/ }));
    await waitFor(() => expect(reject.mutateAsync).toHaveBeenCalledWith('req1'));
  });

  it('status não-pendente mostra badge ao invés de botões', () => {
    requestState.data = { status: HouseCapacityRequestStatus.APPROVED };
    render(<CapacityRequestActions notification={notif()} />);
    expect(screen.queryByRole('button', { name: /Aprovar/ })).not.toBeInTheDocument();
  });

  it('erro de processamento aparece', () => {
    approve.error = new Error('falha');
    render(<CapacityRequestActions notification={notif()} />);
    expect(screen.getByText(/Erro ao processar pedido|falha/)).toBeInTheDocument();
  });
});

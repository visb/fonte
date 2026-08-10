import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockDiscard = jest.fn();
let mockIsDiscarding = false;
jest.mock('../hooks/useSyncQueue', () => ({
  useDiscardItem: () => ({
    mutate: (item: unknown, options?: { onSettled?: () => void }) => {
      mockDiscard(item);
      options?.onSettled?.();
    },
    get isPending() {
      return mockIsDiscarding;
    },
  }),
}));

import { DiscardItemDialog } from './DiscardItemDialog';
import type { SyncQueueItem } from '../hooks/useSyncQueue';

const item: SyncQueueItem = {
  id: 'failed:abc',
  status: 'failed',
  mutationKey: 'storeroom/createMovement',
  label: 'Movimentação da dispensa',
  detail: 'Saída de 3',
  error: 'Quantidade indisponível em estoque.',
  createdAt: 1_000,
  variables: {},
  entryId: 'abc',
};

function renderDialog(props: Partial<React.ComponentProps<typeof DiscardItemDialog>> = {}) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <DiscardItemDialog item={item} onClose={jest.fn()} {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsDiscarding = false;
});

describe('DiscardItemDialog', () => {
  it('só descarta depois da confirmação', async () => {
    const onClose = jest.fn();
    renderDialog({ onClose });

    expect(screen.getByText('Descartar lançamento?')).toBeTruthy();
    expect(mockDiscard).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText('Confirmar descarte'));

    await waitFor(() => expect(mockDiscard).toHaveBeenCalledWith(item));
    expect(onClose).toHaveBeenCalled();
  });

  it('cancelar fecha sem mexer na fila', () => {
    const onClose = jest.fn();
    renderDialog({ onClose });

    fireEvent.press(screen.getByLabelText('Cancelar descarte'));

    expect(mockDiscard).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('sem item o dialog fica fechado e confirmar não faz nada', () => {
    renderDialog({ item: null });

    expect(screen.queryByText('Descartar lançamento?')).toBeNull();
    expect(mockDiscard).not.toHaveBeenCalled();
  });

  it('identifica o lançamento que será perdido', () => {
    renderDialog();
    expect(screen.getByText('Movimentação da dispensa — Saída de 3')).toBeTruthy();
  });

  it('descarte em andamento trava os dois botões', () => {
    mockIsDiscarding = true;
    const onClose = jest.fn();
    renderDialog({ onClose });

    fireEvent.press(screen.getByLabelText('Confirmar descarte'));
    fireEvent.press(screen.getByLabelText('Cancelar descarte'));

    expect(mockDiscard).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('item sem detalhe mostra só o rótulo na confirmação', () => {
    renderDialog({ item: { ...item, detail: null } });
    expect(screen.getByText('Movimentação da dispensa')).toBeTruthy();
  });
});

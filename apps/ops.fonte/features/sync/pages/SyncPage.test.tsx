import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

const mockQueue = jest.fn();
const mockRetry = jest.fn();
const mockDiscard = jest.fn();
jest.mock('../hooks/useSyncQueue', () => ({
  useSyncQueue: () => mockQueue(),
  useRetryFailed: () => ({ mutate: mockRetry, isPending: false }),
  useDiscardItem: () => ({
    mutate: (item: unknown, options?: { onSettled?: () => void }) => {
      mockDiscard(item);
      options?.onSettled?.();
    },
    isPending: false,
  }),
}));

import { SyncPage } from './SyncPage';
import type { SyncQueueItem } from '../hooks/useSyncQueue';

const pendingItem: SyncQueueItem = {
  id: 'pending:1',
  status: 'pending',
  mutationKey: 'supplyRoom/createMovement',
  label: 'Movimentação do almoxarifado',
  detail: 'Entrada de 2',
  createdAt: 2_000,
  variables: {},
  mutationId: 1,
};

const failedItem: SyncQueueItem = {
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

function queue(overrides: Record<string, unknown> = {}) {
  const pending = (overrides.pending as SyncQueueItem[]) ?? [];
  const failed = (overrides.failed as SyncQueueItem[]) ?? [];
  return {
    pending,
    failed,
    items: [...pending, ...failed],
    total: pending.length + failed.length,
    isLoading: false,
    error: null,
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('SyncPage', () => {
  it('fila vazia diz que não há nada pendente', () => {
    mockQueue.mockReturnValue(queue());
    render(<SyncPage />);

    expect(screen.getByText(/Nada pendente/)).toBeTruthy();
    // Sem fila não há o que perder no logout: o aviso não polui a tela.
    expect(screen.queryByTestId('sync-logout-notice')).toBeNull();
  });

  it('com itens dos dois tipos renderiza as duas seções e o aviso de logout', () => {
    mockQueue.mockReturnValue(queue({ pending: [pendingItem], failed: [failedItem] }));
    render(<SyncPage />);

    expect(screen.getByText('Aguardando envio')).toBeTruthy();
    expect(screen.getByText('Não enviadas')).toBeTruthy();
    expect(screen.getByText('Movimentação do almoxarifado')).toBeTruthy();
    expect(screen.getByText('Quantidade indisponível em estoque.')).toBeTruthy();
    expect(screen.getByTestId('sync-logout-notice')).toBeTruthy();
  });

  it('seção sem itens não aparece', () => {
    mockQueue.mockReturnValue(queue({ pending: [pendingItem] }));
    render(<SyncPage />);

    expect(screen.getByText('Aguardando envio')).toBeTruthy();
    expect(screen.queryByText('Não enviadas')).toBeNull();
  });

  it('reenviar só existe em item recusado e dispara a mutation', () => {
    mockQueue.mockReturnValue(queue({ pending: [pendingItem], failed: [failedItem] }));
    render(<SyncPage />);

    const retryButtons = screen.getAllByLabelText('Reenviar lançamento');
    expect(retryButtons).toHaveLength(1);

    fireEvent.press(retryButtons[0]);
    expect(mockRetry).toHaveBeenCalledWith(failedItem);
  });

  it('descartar abre a confirmação e só então descarta', () => {
    mockQueue.mockReturnValue(queue({ pending: [pendingItem] }));
    render(<SyncPage />);

    fireEvent.press(screen.getByLabelText('Descartar lançamento'));
    expect(mockDiscard).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText('Confirmar descarte'));
    expect(mockDiscard).toHaveBeenCalledWith(pendingItem);
  });

  it('enquanto lê a fila mostra carregando; falha de leitura mostra erro', () => {
    mockQueue.mockReturnValue(queue({ isLoading: true }));
    const { rerender } = render(<SyncPage />);
    expect(screen.queryByText(/Nada pendente/)).toBeNull();

    mockQueue.mockReturnValue(queue({ error: new Error('disco') }));
    rerender(<SyncPage />);
    expect(screen.getByText('Não foi possível ler a fila de sincronização.')).toBeTruthy();
  });
});

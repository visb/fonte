import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

import { SyncItemCard } from './SyncItemCard';
import type { FailedSyncItem, PendingSyncItem } from '../hooks/useSyncQueue';

function item(overrides: Partial<PendingSyncItem> = {}): PendingSyncItem {
  return {
    id: 'pending:1',
    status: 'pending',
    mutationKey: 'storeroom/createMovement',
    label: 'Movimentação da dispensa',
    detail: 'Saída de 3',
    createdAt: new Date('2026-08-10T14:32:00').getTime(),
    variables: {},
    mutationId: 1,
    ...overrides,
  };
}

const failed: FailedSyncItem = {
  id: 'failed:abc',
  status: 'failed',
  mutationKey: 'storeroom/createMovement',
  label: 'Movimentação da dispensa',
  detail: 'Saída de 3',
  createdAt: new Date('2026-08-10T14:32:00').getTime(),
  variables: {},
  error: 'Quantidade indisponível em estoque.',
  entryId: 'abc',
};

beforeEach(() => jest.clearAllMocks());

describe('SyncItemCard', () => {
  it('item pendente mostra rótulo, detalhe e selo de espera — sem erro', () => {
    render(<SyncItemCard item={item()} onDiscard={jest.fn()} />);

    expect(screen.getByText('Movimentação da dispensa')).toBeTruthy();
    expect(screen.getByText('Saída de 3')).toBeTruthy();
    expect(screen.getByTestId('sync-status-pending')).toBeTruthy();
    expect(screen.queryByTestId('sync-status-failed')).toBeNull();
    expect(screen.queryByText('Quantidade indisponível em estoque.')).toBeNull();
    // Pendente não se reenvia à mão: sobe sozinho quando a rede voltar.
    expect(screen.queryByLabelText('Reenviar lançamento')).toBeNull();
  });

  it('item recusado mostra a mensagem do backend e o botão de reenviar', () => {
    const onRetry = jest.fn();
    render(<SyncItemCard item={failed} onRetry={onRetry} onDiscard={jest.fn()} />);

    expect(screen.getByTestId('sync-status-failed')).toBeTruthy();
    expect(screen.getByText('Quantidade indisponível em estoque.')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Reenviar lançamento'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('descartar é oferecido nas duas origens e devolve o item', () => {
    const onDiscard = jest.fn();
    const { rerender } = render(<SyncItemCard item={item()} onDiscard={onDiscard} />);
    fireEvent.press(screen.getByLabelText('Descartar lançamento'));

    rerender(<SyncItemCard item={failed} onRetry={jest.fn()} onDiscard={onDiscard} />);
    fireEvent.press(screen.getByLabelText('Descartar lançamento'));

    expect(onDiscard).toHaveBeenNthCalledWith(1, item());
    expect(onDiscard).toHaveBeenNthCalledWith(2, failed);
  });

  it('reenvio em andamento não dispara de novo', () => {
    const onRetry = jest.fn();
    render(<SyncItemCard item={failed} onRetry={onRetry} onDiscard={jest.fn()} isRetrying />);

    fireEvent.press(screen.getByLabelText('Reenviar lançamento'));
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('item sem detalhe mostra só o rótulo', () => {
    render(<SyncItemCard item={item({ detail: null })} onDiscard={jest.fn()} />);

    expect(screen.getByText('Movimentação da dispensa')).toBeTruthy();
    expect(screen.queryByText('Saída de 3')).toBeNull();
  });
});

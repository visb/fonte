import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { WishlistStatus } from '@fonte/types';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/lib/test/utils';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('@/lib/api', () => ({ api: { wishlist: { addItem: jest.fn(), reject: jest.fn() } } }));

import { api } from '@/lib/api';
import { WishlistItemRow } from './WishlistItemRow';
import { PendingWishlistItemRow } from './PendingWishlistItemRow';
import { AddWishlistItemModal } from './AddWishlistItemModal';
import { RejectWishlistItemModal } from './RejectWishlistItemModal';

const m = api as unknown as { wishlist: Record<string, jest.Mock> };

function rc(ui: React.ReactElement) {
  return render(<QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>);
}

beforeEach(() => jest.clearAllMocks());

describe('WishlistItemRow', () => {
  it('item aprovado mostra remover e dispara onRemove', () => {
    const onRemove = jest.fn();
    render(
      <WishlistItemRow
        item={{ id: 'w1', description: 'Tênis', quantity: 1, status: WishlistStatus.APPROVED, isRemovalRequested: false } as never}
        onRemove={onRemove}
        isRemoving={false}
      />,
    );
    expect(screen.getByText('Tênis')).toBeTruthy();
    expect(screen.getByText(/Qtd: 1/)).toBeTruthy();
    fireEvent.press(screen.getByText('icon:trash-outline'));
    expect(onRemove).toHaveBeenCalledWith('w1');
  });

  it('remoção solicitada esconde o botão e mostra aviso', () => {
    render(
      <WishlistItemRow
        item={{ id: 'w1', description: 'Tênis', quantity: 1, status: WishlistStatus.APPROVED, isRemovalRequested: true } as never}
        onRemove={jest.fn()}
        isRemoving={false}
      />,
    );
    expect(screen.getByText('Remoção aguardando aprovação')).toBeTruthy();
    expect(screen.queryByText('icon:trash-outline')).toBeNull();
  });

  it('item rejeitado mostra o motivo', () => {
    render(
      <WishlistItemRow
        item={{ id: 'w1', description: 'Tênis', quantity: 1, status: WishlistStatus.REJECTED, isRemovalRequested: false, rejectionReason: 'sem orçamento' } as never}
        onRemove={jest.fn()}
        isRemoving={false}
      />,
    );
    expect(screen.getByText('sem orçamento')).toBeTruthy();
  });
});

describe('PendingWishlistItemRow', () => {
  const item = { id: 'w1', residentName: 'João', description: 'Tênis', quantity: 2, isRemovalRequested: false };

  it('mostra residente, descrição e dispara aprovar/recusar', () => {
    const onApprove = jest.fn();
    const onReject = jest.fn();
    render(<PendingWishlistItemRow item={item as never} onApprove={onApprove} onReject={onReject} isPending={false} />);
    expect(screen.getByText('João')).toBeTruthy();
    fireEvent.press(screen.getByText('icon:checkmark'));
    expect(onApprove).toHaveBeenCalledWith('w1');
    fireEvent.press(screen.getByText('icon:close'));
    expect(onReject).toHaveBeenCalledWith('w1');
  });
});

describe('AddWishlistItemModal', () => {
  it('descrição vazia não adiciona', () => {
    rc(<AddWishlistItemModal visible onClose={jest.fn()} residentId="r1" />);
    fireEvent.press(screen.getByText('Adicionar'));
    expect(m.wishlist.addItem).not.toHaveBeenCalled();
  });

  it('adiciona com descrição (trim) e quantidade', async () => {
    m.wishlist.addItem.mockResolvedValue({ id: 'w1' });
    rc(<AddWishlistItemModal visible onClose={jest.fn()} residentId="r1" />);
    fireEvent.changeText(screen.getByPlaceholderText(/Bermuda azul/), '  Tênis  ');
    fireEvent.changeText(screen.getByPlaceholderText('1'), '3');
    fireEvent.press(screen.getByText('Adicionar'));
    await waitFor(() => expect(m.wishlist.addItem).toHaveBeenCalledWith('r1', { description: 'Tênis', quantity: 3 }));
  });
});

describe('RejectWishlistItemModal', () => {
  it('itemId null não fica visível', () => {
    const { toJSON } = rc(<RejectWishlistItemModal itemId={null} onClose={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it('recusa com motivo opcional', async () => {
    m.wishlist.reject.mockResolvedValue({ id: 'w1' });
    rc(<RejectWishlistItemModal itemId="w1" onClose={jest.fn()} />);
    fireEvent.changeText(screen.getByPlaceholderText(/Não permitido/), 'fase atual');
    fireEvent.press(screen.getByText('Recusar'));
    await waitFor(() => expect(m.wishlist.reject).toHaveBeenCalledWith('w1', { reason: 'fase atual' }));
  });

  it('recusa sem motivo envia data undefined', async () => {
    m.wishlist.reject.mockResolvedValue({ id: 'w1' });
    rc(<RejectWishlistItemModal itemId="w1" onClose={jest.fn()} />);
    fireEvent.press(screen.getByText('Recusar'));
    await waitFor(() => expect(m.wishlist.reject).toHaveBeenCalledWith('w1', undefined));
  });
});

/**
 * Wishlist depende de a família responder: fica fora da fila offline (decisão 1
 * do epic 167). Sem sinal o pedido é bloqueado com o motivo — story 171.
 */
import { render, screen } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ isResident: true, resident: { id: 'r1' } }),
}));
jest.mock('../hooks/useWishlist', () => ({
  useWishlistItems: () => ({ data: [], refetch: jest.fn() }),
  useRemoveWishlistItem: () => ({ mutate: jest.fn(), isPending: false }),
  usePendingWishlistItems: () => ({ data: [], refetch: jest.fn() }),
  useApproveWishlistItem: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock('../components/AddWishlistItemModal', () => ({
  AddWishlistItemModal: () => null,
}));
jest.mock('../components/RejectWishlistItemModal', () => ({
  RejectWishlistItemModal: () => null,
}));

import { WishlistPage } from './WishlistPage';

afterEach(() => onlineManager.setOnline(true));

describe('WishlistPage sem rede', () => {
  it('desabilita o pedido e explica o motivo', () => {
    onlineManager.setOnline(false);
    render(<WishlistPage />);

    expect(screen.getByText('Precisa de conexão para pedir um item.')).toBeTruthy();
    expect(screen.getByLabelText('Adicionar item').props.accessibilityState?.disabled).toBe(
      true,
    );
  });

  it('com rede o pedido segue disponível', () => {
    onlineManager.setOnline(true);
    render(<WishlistPage />);

    expect(screen.queryByTestId('offline-notice')).toBeNull();
    expect(screen.getByLabelText('Adicionar item').props.accessibilityState?.disabled).toBe(
      false,
    );
  });
});

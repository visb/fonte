import { render, screen } from '@testing-library/react-native';
import type { WishlistItem } from '@fonte/api-client';
import { WishlistItemCard } from './WishlistItemCard';

function makeItem(overrides: Partial<WishlistItem> = {}): WishlistItem {
  return {
    id: 'w1',
    description: 'Bermuda azul tamanho M',
    quantity: 1,
    ...overrides,
  } as WishlistItem;
}

describe('WishlistItemCard', () => {
  it('exibe a descrição do item', () => {
    render(<WishlistItemCard item={makeItem()} />);
    expect(screen.getByText('Bermuda azul tamanho M')).toBeOnTheScreen();
  });

  it('mostra a quantidade quando maior que 1', () => {
    render(<WishlistItemCard item={makeItem({ quantity: 3 })} />);
    expect(screen.getByText('Quantidade: 3')).toBeOnTheScreen();
  });

  it('não mostra a quantidade quando é 1', () => {
    render(<WishlistItemCard item={makeItem({ quantity: 1 })} />);
    expect(screen.queryByText(/Quantidade:/)).toBeNull();
  });
});

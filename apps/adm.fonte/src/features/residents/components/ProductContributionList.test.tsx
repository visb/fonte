import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ReceivableProductContribution } from '@fonte/api-client';
import { ProductContributionList } from './ProductContributionList';
import type { InventoryCatalogItem } from '../hooks/useProductContributions';

const catalog: InventoryCatalogItem[] = [{ id: 's1', name: 'Arroz', unit: 'kg' }];

function contribution(overrides: Partial<ReceivableProductContribution> = {}): ReceivableProductContribution {
  return {
    id: 'c1',
    receivableId: 'rec1',
    inventoryItemId: null,
    inventoryMovementId: null,
    description: null,
    quantity: null,
    unit: null,
    pendingDetailing: false,
    createdByName: null,
    createdAt: '2026-06-01',
    ...overrides,
  };
}

afterEach(() => cleanup());

describe('ProductContributionList', () => {
  it('não renderiza nada quando não há contribuições', () => {
    const { container } = render(<ProductContributionList contributions={[]} catalog={catalog} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('mostra o nome do item do catálogo com quantidade e unidade', () => {
    render(
      <ProductContributionList
        contributions={[contribution({ inventoryItemId: 's1', quantity: 3, unit: 'kg' })]}
        catalog={catalog}
      />,
    );
    expect(screen.getByText('Arroz')).toBeInTheDocument();
    expect(screen.getByText('· 3 kg')).toBeInTheDocument();
    expect(screen.queryByText('Pendente')).not.toBeInTheDocument();
  });

  it('mostra descrição e badge "Pendente" no avulso', () => {
    render(
      <ProductContributionList
        contributions={[contribution({ description: 'cesta básica', pendingDetailing: true })]}
        catalog={catalog}
      />,
    );
    expect(screen.getByText('cesta básica')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
  });

  it('cai no rótulo genérico quando o item não está no catálogo carregado', () => {
    render(
      <ProductContributionList
        contributions={[contribution({ inventoryItemId: 'unknown', quantity: 1, unit: 'un' })]}
        catalog={catalog}
      />,
    );
    expect(screen.getByText('Produto do catálogo')).toBeInTheDocument();
  });
});

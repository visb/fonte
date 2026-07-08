import { Package } from 'lucide-react';
import type { ReceivableProductContribution } from '@fonte/api-client';
import { Badge } from '@/components/ui/badge';
import type { InventoryCatalogItem } from '../hooks/useProductContributions';

interface ItemProps {
  contribution: ReceivableProductContribution;
  catalog: InventoryCatalogItem[];
}

/** Rótulo de uma contribuição: nome do item (catálogo) ou descrição (avulso). */
function contributionLabel(
  contribution: ReceivableProductContribution,
  catalog: InventoryCatalogItem[],
): string {
  if (contribution.description) return contribution.description;
  const item = catalog.find((i) => i.id === contribution.inventoryItemId);
  return item?.name ?? 'Produto do catálogo';
}

/** Quantidade + unidade formatadas, quando informadas. */
function quantityLabel(contribution: ReceivableProductContribution): string | null {
  if (contribution.quantity == null) return null;
  return `${contribution.quantity}${contribution.unit ? ` ${contribution.unit}` : ''}`;
}

export function ProductContributionItem({ contribution, catalog }: ItemProps) {
  const qty = quantityLabel(contribution);
  return (
    <div className="flex items-center gap-2 text-xs">
      <Package size={13} className="shrink-0 text-muted-foreground" />
      <span className="text-foreground">{contributionLabel(contribution, catalog)}</span>
      {qty && <span className="text-muted-foreground">· {qty}</span>}
      {contribution.pendingDetailing && (
        <Badge variant="warning" className="ml-auto shrink-0">
          Pendente
        </Badge>
      )}
    </div>
  );
}

interface ListProps {
  contributions: ReceivableProductContribution[];
  catalog: InventoryCatalogItem[];
}

export function ProductContributionList({ contributions, catalog }: ListProps) {
  if (!contributions.length) return null;
  return (
    <div className="mt-2 space-y-1 border-t pt-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Produtos</p>
      {contributions.map((c) => (
        <ProductContributionItem key={c.id} contribution={c} catalog={catalog} />
      ))}
    </div>
  );
}

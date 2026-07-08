import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReceivableProductContribution } from '@fonte/api-client';
import type { InventoryCatalogItem } from '../hooks/useProductContributions';

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

function ProductContributionItem({
  contribution,
  catalog,
}: {
  contribution: ReceivableProductContribution;
  catalog: InventoryCatalogItem[];
}) {
  const qty = quantityLabel(contribution);
  return (
    <View className="flex-row items-center py-2 border-b border-gray-100">
      <Ionicons name="cube-outline" size={15} color="#6b7280" />
      <Text className="text-sm text-gray-800 ml-2">{contributionLabel(contribution, catalog)}</Text>
      {qty && <Text className="text-xs text-gray-500 ml-2">· {qty}</Text>}
      {contribution.pendingDetailing && (
        <View className="ml-auto rounded-full bg-amber-100 px-2 py-0.5">
          <Text className="text-[11px] font-medium text-amber-700">Pendente</Text>
        </View>
      )}
    </View>
  );
}

interface Props {
  contributions: ReceivableProductContribution[];
  catalog: InventoryCatalogItem[];
}

export function ProductContributionList({ contributions, catalog }: Props) {
  if (!contributions.length) return null;
  return (
    <View className="mt-4">
      <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
        Já declarados
      </Text>
      {contributions.map((c) => (
        <ProductContributionItem key={c.id} contribution={c} catalog={catalog} />
      ))}
    </View>
  );
}

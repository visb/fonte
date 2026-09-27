import { Text, View } from 'react-native';
import type { ReceivableProductContribution } from '@fonte/types';
import { isPendingContribution } from '@/lib/offline/productContributions';

export function ContributionSummary({ lines }: { lines: ReceivableProductContribution[] }) {
  const catalogCount = lines.filter((line) => line.inventoryItemId).length;
  const descriptions = lines.filter((line) => !line.inventoryItemId).map((line) => line.description);
  return (
    <View>
      {catalogCount > 0 && <Text className="text-sm text-gray-600">{`${catalogCount} ${catalogCount === 1 ? 'item' : 'itens'} do catálogo`}</Text>}
      {descriptions.map((description, index) => <Text key={index} className="text-sm text-gray-600">{description}</Text>)}
      {lines.some((line) => line.pendingDetailing) && <Text className="text-xs text-gray-500">Pendente de detalhamento</Text>}
      {lines.some(isPendingContribution) && <Text className="text-xs text-amber-700">Aguardando envio</Text>}
    </View>
  );
}

import { View, Text, FlatList } from 'react-native';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { WishlistItemCard } from '../components/WishlistItemCard';
import { useWishlistItems } from '../hooks/useWishlist';

export function WishlistPage() {
  const { relative } = useAuth();
  const residentId = relative?.residentId ?? '';

  const { data: items = [], isLoading, isError, refetch } = useWishlistItems(residentId);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 py-4 border-b border-gray-100 bg-white">
        <Text className="text-base font-semibold text-gray-900">
          Lista de pedidos de {relative?.residentName}
        </Text>
        <Text className="text-sm text-gray-500 mt-0.5">
          Itens aprovados para a próxima visita
        </Text>
      </View>

      {items.length === 0 ? (
        <EmptyState message="Nenhum pedido aprovado no momento." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          renderItem={({ item }) => <WishlistItemCard item={item} />}
        />
      )}
    </View>
  );
}

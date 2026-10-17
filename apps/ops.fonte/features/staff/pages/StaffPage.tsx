import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { useHouseStaff } from '../hooks/useHouseStaff';
import { StaffListItem } from '../components/StaffListItem';
import { sortHouseStaff } from '../constants';

/**
 * Lista dos servos da casa (story 204): somente leitura + WhatsApp. Cadastro
 * de servo continua no `adm`. Funciona offline (key persistida e pré-carregada).
 */
export function StaffPage() {
  const { staff } = useAuth();
  const houseId = staff?.houseId ?? null;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data, isLoading, error, refetch } = useHouseStaff(houseId);
  const members = useMemo(() => sortHouseStaff(data ?? []), [data]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Servos' }} />
      <View className="flex-1 bg-gray-50">
        {!houseId ? (
          <EmptyState message="Você não está lotado em uma casa." />
        ) : isLoading ? (
          <LoadingState />
        ) : error && members.length === 0 ? (
          <ErrorState onRetry={refetch} />
        ) : (
          <FlatList
            data={members}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            ListEmptyComponent={<EmptyState message="Nenhum servo nesta casa." />}
            renderItem={({ item }) => <StaffListItem item={item} isSelf={item.id === staff?.id} />}
          />
        )}
      </View>
    </>
  );
}

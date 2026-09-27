import { useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { normalizeForSearch } from '@/lib/searchUtils';
import { useResidentsByHouse } from '@/features/residents/hooks/useResidents';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { LastSyncedAt } from '@/components/shared/LastSyncedAt';
import { useLastSyncedAt } from '@/lib/offline/store/useLastSyncedAt';
import { PickContributionResidentRow } from '../components/PickContributionResidentRow';

export function PickResidentPage() {
  const { staff } = useAuth();
  const houseId = staff?.houseId;
  const [search, setSearch] = useState('');
  const query = useResidentsByHouse(houseId);
  const syncedAt = useLastSyncedAt(houseId);
  const filtered = (query.data ?? []).filter((resident) => normalizeForSearch(resident.name).includes(normalizeForSearch(search)));
  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: 'Escolher filho' }} />
      <TextInput accessibilityLabel="Buscar filho" placeholder="Buscar por nome" value={search} onChangeText={setSearch}
        className="border border-gray-200 rounded-lg m-4 p-3" />
      <LastSyncedAt syncedAt={syncedAt} />
      {query.isLoading ? <LoadingState /> : query.error && !query.data ? (
        <ErrorState message="Erro ao carregar filhos." onRetry={query.refetch} />
      ) : (
        <FlatList data={filtered} keyExtractor={(item) => item.id}
          refreshing={query.isRefetching && query.fetchStatus === 'fetching'} onRefresh={query.refetch}
          ListEmptyComponent={<EmptyState message="Nenhum filho encontrado." />}
          renderItem={({ item }) => <PickContributionResidentRow resident={item} houseId={houseId!} />} />
      )}
    </View>
  );
}

import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { LastSyncedAt } from '@/components/shared/LastSyncedAt';
import { SuccessBanner } from '@/components/shared/SuccessBanner';
import { useLastSyncedAt } from '@/lib/offline/store/useLastSyncedAt';
import { useHouseProductContributions } from '../hooks/useHouseProductContributions';
import { ContributionResidentRow } from '../components/ContributionResidentRow';

export function ContributionsQueuePage() {
  const { staff } = useAuth();
  const query = useHouseProductContributions(staff?.houseId);
  const syncedAt = useLastSyncedAt(staff?.houseId);
  const { successMsg } = useLocalSearchParams<{ successMsg?: string }>();
  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: 'Contribuições' }} />
      {successMsg && <SuccessBanner message={successMsg} onDismiss={() => router.setParams({ successMsg: '' })} />}
      <LastSyncedAt syncedAt={syncedAt} />
      {query.isLoading ? <LoadingState /> : query.error && !query.data ? (
        <ErrorState message="Erro ao carregar contribuições." onRetry={query.refetch} />
      ) : (
        <FlatList data={query.data ?? []} keyExtractor={(item) => item.receivableId}
          contentContainerStyle={{ padding: 16, paddingBottom: 96 }}
          refreshing={query.isRefetching && query.fetchStatus === 'fetching'} onRefresh={query.refetch}
          ListEmptyComponent={<EmptyState message="Nenhuma contribuição declarada neste mês." />}
          renderItem={({ item }) => <ContributionResidentRow contribution={item} />} />
      )}
      <TouchableOpacity accessibilityRole="button" className="absolute bottom-6 right-6 rounded-full bg-indigo-900 px-5 py-4"
        onPress={() => router.push('/(app)/contributions/pick-resident' as never)}>
        <Text className="text-white font-semibold">Nova declaração</Text>
      </TouchableOpacity>
    </View>
  );
}

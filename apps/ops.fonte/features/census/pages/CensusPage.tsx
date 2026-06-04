import { useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Resident } from '@fonte/api-client';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { useActiveResidentsByHouse } from '../hooks/useCensus';
import { CensusListItem } from '../components/CensusListItem';
import { AddResidentModal } from '../components/AddResidentModal';
import { RemoveResidentModal } from '../components/RemoveResidentModal';

export function CensusPage() {
  const { staff } = useAuth();
  const houseId = staff?.houseId;

  const { data: residents = [], isLoading, error, refetch } = useActiveResidentsByHouse(houseId);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);

  if (!houseId) return <EmptyState message="Você não está vinculado a uma casa." />;
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState onRetry={refetch} />;

  function toggleConfirm(id: string) {
    setConfirmedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-sm text-gray-500">
          {confirmedIds.size}/{residents.length} confirmados
        </Text>
        <TouchableOpacity
          className="flex-row items-center bg-blue-600 rounded-xl px-3 py-2"
          onPress={() => setAddOpen(true)}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text className="text-sm font-medium text-white ml-1">Adicionar filho</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={residents}
        keyExtractor={(item: Resident) => item.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }: { item: Resident }) => (
          <CensusListItem
            resident={item}
            confirmed={confirmedIds.has(item.id)}
            onConfirm={() => toggleConfirm(item.id)}
            onRemove={() => setRemoveTarget({ id: item.id, name: item.name })}
          />
        )}
        ListEmptyComponent={<EmptyState message="Nenhum filho ativo nesta casa." />}
      />

      <AddResidentModal
        visible={addOpen}
        houseId={houseId}
        onClose={() => setAddOpen(false)}
        onSuccess={() => refetch()}
      />

      <RemoveResidentModal
        visible={!!removeTarget}
        houseId={houseId}
        resident={removeTarget}
        onClose={() => setRemoveTarget(null)}
        onSuccess={() => refetch()}
      />
    </View>
  );
}

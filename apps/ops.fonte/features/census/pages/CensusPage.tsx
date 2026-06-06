import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ResidentStatus } from '@fonte/types';
import type { Resident } from '@fonte/api-client';
import { useAuth } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { useActiveResidentsByHouse, useConcludeCensus } from '../hooks/useCensus';
import { CensusListItem } from '../components/CensusListItem';
import { AddResidentModal } from '../components/AddResidentModal';
import { RemoveResidentModal } from '../components/RemoveResidentModal';
import { ConcludeCensusModal } from '../components/ConcludeCensusModal';

const isPending = (r: Resident) => r.status === ResidentStatus.CENSUS_ADDED;

export function CensusPage() {
  const { staff } = useAuth();
  const houseId = staff?.houseId;

  const { data: residents = [], isLoading, error, refetch } = useActiveResidentsByHouse(houseId);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [concludeOpen, setConcludeOpen] = useState(false);
  const concludeMutation = useConcludeCensus(houseId ?? '');

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

  // Residents added during this census count as present (auto-confirmed).
  const isConfirmed = (r: Resident) => isPending(r) || confirmedIds.has(r.id);
  const confirmedCount = residents.filter(isConfirmed).length;
  const total = residents.length;
  const allConfirmed = total > 0 && confirmedCount === total;

  function handleConclude() {
    concludeMutation.mutate(
      { houseId: houseId!, confirmedCount, total },
      {
        onSuccess: () => {
          setConcludeOpen(false);
          Alert.alert('Contagem concluída', 'O ADM foi notificado.');
        },
        onError: (err) =>
          Alert.alert('Erro', getErrorMessage(err, 'Não foi possível concluir a contagem.')),
      },
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-sm text-gray-500">
          {confirmedCount}/{total} confirmados
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
            confirmed={isConfirmed(item)}
            pending={isPending(item)}
            onConfirm={() => toggleConfirm(item.id)}
            onRemove={() => setRemoveTarget({ id: item.id, name: item.name })}
          />
        )}
        ListEmptyComponent={<EmptyState message="Nenhum filho ativo nesta casa." />}
      />

      <View className="px-4 pt-2 pb-6 border-t border-gray-100 bg-white">
        <TouchableOpacity
          className={`rounded-xl py-3.5 items-center ${allConfirmed ? 'bg-green-600' : 'bg-gray-200'}`}
          onPress={() => setConcludeOpen(true)}
          disabled={!allConfirmed}
        >
          <Text className={`text-sm font-semibold ${allConfirmed ? 'text-white' : 'text-gray-400'}`}>
            Concluir contagem
          </Text>
        </TouchableOpacity>
        {!allConfirmed && total > 0 ? (
          <Text className="text-xs text-gray-400 text-center mt-2">
            Confirme todos os filhos para concluir.
          </Text>
        ) : null}
      </View>

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

      <ConcludeCensusModal
        visible={concludeOpen}
        confirmedCount={confirmedCount}
        total={total}
        isPending={concludeMutation.isPending}
        onConfirm={handleConclude}
        onClose={() => setConcludeOpen(false)}
      />
    </View>
  );
}

import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { REMOVABLE_RESIDENT_STATUSES, ResidentStatus, Role } from '@fonte/types';
import type { Resident } from '@fonte/api-client';
import { useAuth } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { useFieldSubmit } from '@/lib/offline/fieldSubmit';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { useActiveResidentsByHouse, useConcludeCensus } from '../hooks/useCensus';
import { ResidentPhotoViewer } from '@/features/residents/components/ResidentPhotoViewer';
import { CensusListItem } from '../components/CensusListItem';
import { AddResidentModal } from '../components/AddResidentModal';
import { RemoveResidentModal } from '@/features/residents/components/RemoveResidentModal';
import { ConcludeCensusModal } from '../components/ConcludeCensusModal';
import { ResidentDetailModal } from '../components/ResidentDetailModal';

const isPending = (r: Resident) => r.status === ResidentStatus.CENSUS_ADDED;

export function CensusPage() {
  const { staff } = useAuth();
  const houseId = staff?.houseId;
  const canRemove = staff?.user?.role === Role.ADMIN || staff?.user?.role === Role.COORDINATOR;

  const { data: residents = [], isLoading, error, refetch } = useActiveResidentsByHouse(houseId);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [concludeOpen, setConcludeOpen] = useState(false);
  // Story 179: consulta, não ação. Nenhum dos dois mexe em `confirmedIds` —
  // abrir a ficha no pátio não pode confirmar (nem desconfirmar) presença.
  const [detailTarget, setDetailTarget] = useState<Resident | null>(null);
  const [photoTarget, setPhotoTarget] = useState<Resident | null>(null);
  const concludeMutation = useConcludeCensus(houseId ?? '');
  const submitConclude = useFieldSubmit(concludeMutation);

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
    submitConclude(
      { houseId: houseId!, confirmedCount, total },
      {
        onSent: () => {
          setConcludeOpen(false);
          Alert.alert('Contagem concluída', 'O ADM foi notificado.');
        },
        // A contagem acontece no pátio, onde quase nunca há sinal: offline ela
        // entra na fila e o ADM é notificado quando subir (story 171).
        onQueued: () => {
          setConcludeOpen(false);
          Alert.alert(
            'Contagem salva',
            'Sem conexão agora: será enviada assim que a conexão voltar.',
          );
        },
        onFailed: (err) =>
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
            onRemove={canRemove && REMOVABLE_RESIDENT_STATUSES.includes(item.status)
              ? () => setRemoveTarget({ id: item.id, name: item.name })
              : undefined}
            onOpenDetails={() => setDetailTarget(item)}
            onOpenPhoto={() => setPhotoTarget(item)}
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

      <ResidentDetailModal
        visible={!!detailTarget}
        resident={detailTarget}
        onClose={() => setDetailTarget(null)}
      />

      <ResidentPhotoViewer
        visible={!!photoTarget}
        name={photoTarget?.name ?? ''}
        photoUrl={photoTarget?.photoUrl}
        photoThumbUrl={photoTarget?.photoThumbUrl}
        onClose={() => setPhotoTarget(null)}
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

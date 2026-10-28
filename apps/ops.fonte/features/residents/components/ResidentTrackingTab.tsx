import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { useResidentIncidents } from '@/features/incidents/hooks/useIncidents';
import { AddFollowUpModal } from './AddFollowUpModal';
import { TrackingTimelineItem } from './TrackingTimelineItem';
import { useResidentFollowUps } from '../hooks/useResidentFollowUps';
import { mergeTrackingTimeline } from '../lib/trackingTimeline';

interface Props {
  residentId: string;
}

export const INCIDENTS_LOAD_ERROR = 'Não foi possível carregar as ocorrências';

/**
 * Linha do tempo do filho: follow-ups + ocorrências em que ele está envolvido
 * (story 228). Erro só das ocorrências não derruba a aba: mostra os follow-ups
 * e um aviso. O "Registrar" continua criando follow-up.
 */
export function ResidentTrackingTab({ residentId }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const followUps = useResidentFollowUps(residentId);
  const incidents = useResidentIncidents(residentId);

  if (followUps.isLoading || incidents.isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  if (followUps.isError) {
    return <ErrorState message="Erro ao carregar acompanhamento." />;
  }

  const timeline = mergeTrackingTimeline(followUps.data, incidents.data);

  return (
    <View className="flex-1">
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Histórico de eventos
        </Text>
        <Pressable
          className="flex-row items-center gap-1 bg-blue-600 px-3 py-1.5 rounded-lg"
          onPress={() => setModalOpen(true)}
        >
          <Ionicons name="add" size={16} color="#fff" />
          <Text className="text-xs font-medium text-white">Registrar</Text>
        </Pressable>
      </View>

      {incidents.isError && (
        <Text testID="incidents-load-error" className="px-4 pb-2 text-xs text-amber-700">
          {INCIDENTS_LOAD_ERROR}
        </Text>
      )}

      {!timeline.length ? (
        <EmptyState message="Nenhum evento registrado." />
      ) : (
        <ScrollView className="px-4" contentContainerClassName="pb-6">
          {timeline.map((entry) => (
            <TrackingTimelineItem key={entry.key} entry={entry} residentId={residentId} />
          ))}
        </ScrollView>
      )}

      <AddFollowUpModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        residentId={residentId}
      />
    </View>
  );
}

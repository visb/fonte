import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { AddFollowUpModal } from './AddFollowUpModal';
import { TrackingEventItem } from './TrackingEventItem';
import { useResidentFollowUps } from '../hooks/useResidentFollowUps';

interface Props {
  residentId: string;
}

export function ResidentTrackingTab({ residentId }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: followUps, isLoading, isError } = useResidentFollowUps(residentId);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  if (isError) {
    return <ErrorState message="Erro ao carregar acompanhamento." />;
  }

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

      {!followUps?.length ? (
        <EmptyState message="Nenhum evento registrado." />
      ) : (
        <ScrollView className="px-4" contentContainerClassName="pb-6">
          {followUps.map((fu) => (
            <TrackingEventItem key={fu.id} followUp={fu} />
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

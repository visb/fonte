import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Stack as RouterStack } from 'expo-router';
import type { Event } from '@fonte/api-client';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { useInternalEvents } from '../hooks/useInternalEvents';
import { EventCard } from '../components/EventCard';

/**
 * Lista só-leitura de eventos internos (story 94) no ops.fonte. Sem criação —
 * os servos apenas consultam a agenda voltada à equipe.
 */
export function InternalEventsPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: events = [], isLoading, error, refetch } = useInternalEvents();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <>
        <RouterStack.Screen options={{ title: 'Eventos internos' }} />
        <LoadingState />
      </>
    );
  }

  if (error) {
    return (
      <>
        <RouterStack.Screen options={{ title: 'Eventos internos' }} />
        <ErrorState message="Erro ao carregar eventos internos." onRetry={refetch} />
      </>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <RouterStack.Screen options={{ title: 'Eventos internos' }} />
      <FlatList
        data={events}
        keyExtractor={(item: Event) => item.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={<EmptyState message="Nenhum evento interno agendado." />}
        renderItem={({ item }: { item: Event }) => <EventCard event={item} />}
      />
    </View>
  );
}

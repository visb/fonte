import { View, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Event } from '@fonte/api-client';
import { resolveAssetUrl } from '@/lib/api';

/** Formata o intervalo do evento (dd/mm/aaaa hh:mm, fim opcional). */
export function formatEventDate(startAt: string, endAt: string | null): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    const date = d.toLocaleDateString('pt-BR');
    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
  };
  return endAt ? `${fmt(startAt)} — ${fmt(endAt)}` : fmt(startAt);
}

interface Props {
  event: Event;
}

/** Card só-leitura de um evento interno (story 94) no ops.fonte. */
export function EventCard({ event }: Props) {
  const bannerUri = resolveAssetUrl(event.bannerUrl ?? null);

  return (
    <View
      testID="internal-event-card"
      className="rounded-xl border border-gray-200 bg-white p-4"
    >
      <View className="flex-row items-center gap-2 mb-1">
        <View className="rounded-full bg-amber-100 px-2 py-0.5">
          <Text className="text-[11px] font-semibold text-amber-700">Interno</Text>
        </View>
      </View>
      <Text className="text-base font-semibold text-gray-900">{event.title}</Text>

      <View className="flex-row items-center gap-1 mt-1">
        <Ionicons name="calendar-outline" size={13} color="#6b7280" />
        <Text className="text-xs text-gray-500">
          {formatEventDate(event.startAt, event.endAt)}
        </Text>
      </View>

      {event.location ? (
        <View className="flex-row items-center gap-1 mt-1">
          <Ionicons name="location-outline" size={13} color="#6b7280" />
          <Text className="text-xs text-gray-500">{event.location}</Text>
        </View>
      ) : null}

      {event.description ? (
        <Text className="text-sm text-gray-600 mt-2" numberOfLines={3}>
          {event.description}
        </Text>
      ) : null}

      {bannerUri ? (
        <Image
          source={{ uri: bannerUri }}
          className="w-full h-32 rounded-lg mt-3"
          resizeMode="cover"
        />
      ) : null}
    </View>
  );
}

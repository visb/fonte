import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ActivityEvent } from '@fonte/api-client';
import { ACTIVITY_EVENT_CONFIG } from '@/features/activities/constants';
import {
  describeActivityEvent,
  type StaffNameResolver,
} from '@/features/activities/lib/eventDescription';

interface Props {
  event: ActivityEvent;
  resolveStaffName: StaffNameResolver;
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('pt-BR');
}

/** Uma linha da trilha (story 220): ícone, ator, o quê e quando. */
export function ActivityHistoryItem({ event, resolveStaffName }: Props) {
  const icon = ACTIVITY_EVENT_CONFIG[event.type]?.icon ?? 'ellipse-outline';
  const actor = event.actor?.name ?? 'Alguém';

  return (
    <View
      testID={`activity-event-${event.id}`}
      className="flex-row items-start gap-3 py-2.5 border-b border-gray-100"
    >
      <View className="h-7 w-7 items-center justify-center rounded-full bg-gray-100 mt-0.5">
        <Ionicons name={icon as never} size={14} color="#4b5563" />
      </View>
      <View className="flex-1">
        <Text className="text-sm text-gray-800">
          <Text className="font-semibold">{actor}</Text>{' '}
          {describeActivityEvent(event, resolveStaffName)}
        </Text>
        <Text className="text-xs text-gray-400 mt-0.5">{formatDateTime(event.createdAt)}</Text>
      </View>
    </View>
  );
}

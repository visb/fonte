import { TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { SupportGroupMeeting } from '@fonte/api-client';

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split('T')[0];
}

interface Props {
  meeting: SupportGroupMeeting;
}

export function MeetingCard({ meeting }: Props) {
  const today = isToday(meeting.date);

  return (
    <TouchableOpacity
      className={`rounded-xl p-4 border ${today ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onPress={() => router.push(`/(app)/support-groups/${meeting.id}` as any)}
      activeOpacity={0.7}
    >
      {today && (
        <View className="flex-row items-center gap-1 mb-1">
          <View className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <Text className="text-xs font-semibold text-blue-600">HOJE</Text>
        </View>
      )}
      <Text className="text-base font-semibold text-gray-900">{meeting.supportGroupName}</Text>
      <Text className="text-sm text-gray-500 mt-0.5">{formatDate(meeting.date)}</Text>
      {meeting.notes ? (
        <Text className="text-xs text-gray-400 mt-1 italic">{meeting.notes}</Text>
      ) : null}
      <View className="flex-row items-center gap-1 mt-2">
        <Ionicons name="people-outline" size={13} color="#6b7280" />
        <Text className="text-xs text-gray-500">
          {meeting.checkinCount} {meeting.checkinCount === 1 ? 'família presente' : 'famílias presentes'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

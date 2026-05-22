import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

interface Props {
  seconds: number;
  onCancel: () => void;
}

export function RecordingBar({ seconds, onCancel }: Props) {
  return (
    <View className="flex-1 flex-row items-center bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5 gap-2">
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
      <Text className="text-red-600 text-sm flex-1">
        Gravando... {formatDuration(seconds)}
      </Text>
      <TouchableOpacity onPress={onCancel}>
        <Ionicons name="trash-outline" size={18} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );
}

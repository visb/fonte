import { TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MinistryTask } from '@fonte/api-client';

function isCompletedToday(completedAt: string | null): boolean {
  if (!completedAt) return false;
  const today = new Date().toISOString().slice(0, 10);
  return completedAt.slice(0, 10) === today;
}

interface Props {
  task: MinistryTask;
  onToggle: (taskId: string, done: boolean) => void;
  onDelete: (taskId: string) => void;
}

export function MinistryTaskRow({ task, onToggle, onDelete }: Props) {
  const done = task.repetition === 'DAILY' ? isCompletedToday(task.completedAt) : task.completed;

  return (
    <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-4 py-3 gap-3">
      <TouchableOpacity onPress={() => onToggle(task.id, done)}>
        <Ionicons
          name={done ? 'checkbox' : 'square-outline'}
          size={22}
          color={done ? '#2563eb' : '#9ca3af'}
        />
      </TouchableOpacity>
      <View className="flex-1">
        <Text className={`text-sm ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {task.title}
        </Text>
        {task.repetition === 'DAILY' && (
          <Text className="text-xs text-gray-400 mt-0.5">Repetição diária</Text>
        )}
      </View>
      <TouchableOpacity onPress={() => onDelete(task.id)}>
        <Ionicons name="close-circle-outline" size={20} color="#9ca3af" />
      </TouchableOpacity>
    </View>
  );
}

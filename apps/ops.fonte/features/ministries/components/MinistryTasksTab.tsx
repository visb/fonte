import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MinistryTask } from '@fonte/api-client';
import { useMinistryTasks, useUpdateTask, useDeleteTask } from '../hooks/useMinistries';
import { MinistryTaskRow } from './MinistryTaskRow';
import { LoadingState } from '@/components/shared/LoadingState';

interface Props {
  ministryId: string;
  onAddTask: () => void;
}

export function MinistryTasksTab({ ministryId, onAddTask }: Props) {
  const { data: tasks = [], isLoading } = useMinistryTasks(ministryId);
  const updateTask = useUpdateTask(ministryId);
  const deleteTask = useDeleteTask(ministryId);

  if (isLoading) return <LoadingState />;

  return (
    <>
      <FlatList
        data={tasks}
        keyExtractor={(item: MinistryTask) => item.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListEmptyComponent={
          <Text className="text-center text-gray-500 text-sm py-8">
            Nenhuma tarefa cadastrada.
          </Text>
        }
        renderItem={({ item }: { item: MinistryTask }) => (
          <MinistryTaskRow
            task={item}
            onToggle={(taskId, done) => updateTask.mutate({ taskId, data: { completed: !done } })}
            onDelete={(taskId) => deleteTask.mutate(taskId)}
          />
        )}
      />

      <TouchableOpacity
        accessibilityLabel="Nova tarefa"
        className="absolute bottom-6 right-6 bg-blue-600 w-14 h-14 rounded-full items-center justify-center shadow-md"
        onPress={onAddTask}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
    </>
  );
}

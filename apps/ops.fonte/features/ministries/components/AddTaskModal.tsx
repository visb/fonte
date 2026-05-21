import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useCreateTask } from '../hooks/useMinistries';

interface Props {
  visible: boolean;
  onClose: () => void;
  ministryId: string;
}

export function AddTaskModal({ visible, onClose, ministryId }: Props) {
  const [title, setTitle] = useState('');
  const [repetition, setRepetition] = useState<'NONE' | 'DAILY'>('NONE');
  const createTask = useCreateTask(ministryId);

  function handleClose() {
    setTitle('');
    setRepetition('NONE');
    onClose();
  }

  function handleCreate() {
    if (!title.trim()) return;
    createTask.mutate(
      { title: title.trim(), repetition },
      { onSuccess: handleClose },
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable className="flex-1 bg-black/40 justify-center px-6" onPress={handleClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View className="bg-white rounded-2xl p-6">
            <Text className="text-base font-semibold text-gray-900 mb-4">Nova Tarefa</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 mb-4"
              placeholder="Título da tarefa"
              value={title}
              onChangeText={setTitle}
              autoFocus
            />
            <Text className="text-sm font-medium text-gray-700 mb-2">Repetição</Text>
            <View className="flex-row gap-3 mb-4">
              <TouchableOpacity
                className={`flex-1 py-2.5 rounded-lg border items-center ${repetition === 'NONE' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                onPress={() => setRepetition('NONE')}
              >
                <Text className={`text-sm ${repetition === 'NONE' ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
                  Não repetir
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 py-2.5 rounded-lg border items-center ${repetition === 'DAILY' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                onPress={() => setRepetition('DAILY')}
              >
                <Text className={`text-sm ${repetition === 'DAILY' ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
                  Diária
                </Text>
              </TouchableOpacity>
            </View>
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 border border-gray-200 rounded-lg py-2.5 items-center"
                onPress={handleClose}
              >
                <Text className="text-sm text-gray-600">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-blue-600 rounded-lg py-2.5 items-center"
                onPress={handleCreate}
                disabled={!title.trim() || createTask.isPending}
              >
                <Text className="text-sm text-white font-medium">
                  {createTask.isPending ? 'Adicionando...' : 'Adicionar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

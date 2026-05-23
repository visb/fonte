import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FollowUpAccessLevel, FollowUpType } from '@fonte/types';
import { FOLLOW_UP_TYPE_LABELS } from '../constants';
import { useCreateFollowUp } from '../hooks/useResidentFollowUps';

interface Props {
  visible: boolean;
  onClose: () => void;
  residentId: string;
}

const TODAY = new Date().toISOString().split('T')[0];

export function AddFollowUpModal({ visible, onClose, residentId }: Props) {
  const mutation = useCreateFollowUp(residentId);

  const [date, setDate] = useState(TODAY);
  const [type, setType] = useState<FollowUpType>(FollowUpType.NOTE);
  const [description, setDescription] = useState('');
  const [typePickerOpen, setTypePickerOpen] = useState(false);

  function handleClose() {
    setDate(TODAY);
    setType(FollowUpType.NOTE);
    setDescription('');
    setTypePickerOpen(false);
    onClose();
  }

  function handleSubmit() {
    mutation.mutate(
      {
        date,
        type,
        description: description.trim() || undefined,
        accessLevel: FollowUpAccessLevel.ALL,
      },
      { onSuccess: handleClose },
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={handleClose} />
        <View className="bg-white rounded-t-3xl max-h-[85%]">
          {/* Header */}
          <View className="px-5 pt-5 pb-3 border-b border-gray-100 flex-row items-center">
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-900">Registrar evento</Text>
            </View>
            <Pressable
              className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center"
              onPress={handleClose}
              hitSlop={8}
            >
              <Ionicons name="close" size={20} color="#4b5563" />
            </Pressable>
          </View>

          <ScrollView className="px-5" contentContainerClassName="py-4 gap-4">
            {/* Data */}
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1.5">Data</Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900"
                value={date}
                onChangeText={setDate}
                placeholder="AAAA-MM-DD"
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
              />
            </View>

            {/* Tipo */}
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1.5">Tipo</Text>
              <Pressable
                className="border border-gray-200 rounded-xl px-4 py-3 flex-row items-center justify-between"
                onPress={() => setTypePickerOpen(true)}
              >
                <Text className="text-sm text-gray-900">{FOLLOW_UP_TYPE_LABELS[type]}</Text>
                <Ionicons name="chevron-down" size={16} color="#9ca3af" />
              </Pressable>
            </View>

            {/* Descrição */}
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1.5">Descrição (opcional)</Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900"
                value={description}
                onChangeText={setDescription}
                placeholder="Detalhes do evento..."
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View className="px-5 py-4 border-t border-gray-100 flex-row gap-3">
            <Pressable
              className="flex-1 py-3 rounded-xl border border-gray-200 items-center"
              onPress={handleClose}
              disabled={mutation.isPending}
            >
              <Text className="text-sm font-medium text-gray-600">Cancelar</Text>
            </Pressable>
            <Pressable
              className="flex-1 py-3 rounded-xl bg-blue-600 items-center"
              onPress={handleSubmit}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-sm font-medium text-white">Salvar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {/* Type Picker Overlay */}
      <Modal
        visible={typePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTypePickerOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setTypePickerOpen(false)}
        >
          <View className="bg-white rounded-t-3xl max-h-[70%]">
            <View className="px-5 pt-5 pb-3 border-b border-gray-100">
              <Text className="text-lg font-semibold text-gray-900">Selecionar tipo</Text>
            </View>
            <ScrollView className="px-4" contentContainerClassName="py-4 gap-2">
              {Object.values(FollowUpType).map((t) => (
                <Pressable
                  key={t}
                  className={`flex-row items-center px-4 py-3 rounded-xl border ${
                    type === t ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                  onPress={() => {
                    setType(t);
                    setTypePickerOpen(false);
                  }}
                >
                  <Text className={`text-sm flex-1 ${type === t ? 'text-blue-700 font-medium' : 'text-gray-800'}`}>
                    {FOLLOW_UP_TYPE_LABELS[t]}
                  </Text>
                  {type === t && <Ionicons name="checkmark" size={18} color="#1d4ed8" />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </Modal>
  );
}

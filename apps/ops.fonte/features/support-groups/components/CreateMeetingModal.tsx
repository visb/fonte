import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SupportGroup } from '@fonte/api-client';
import { DAY_OF_WEEK_LABELS, todayInSaoPaulo } from '@fonte/types';
import { DateInput } from '@/components/shared/DateInput';
import { useCreateMeeting, useSupportGroups } from '../hooks/useSupportGroups';

const MEETING_DATE_REQUIRED_MESSAGE = 'Informe a data da reunião (dd/mm/aaaa).';

/**
 * Próxima data (hoje incluso) que cai no dia da semana do grupo. Parte do "hoje"
 * no fuso da operação e calcula em UTC puro — `toISOString()` sobre a data
 * local virava o dia seguinte depois das 21h (story 209, decisão 8).
 */
function nextMeetingDate(dayOfWeek: number): string {
  const [year, month, day] = todayInSaoPaulo().split('-').map(Number);
  const today = new Date(Date.UTC(year, month - 1, day));
  const diff = (dayOfWeek - today.getUTCDay() + 7) % 7;
  today.setUTCDate(today.getUTCDate() + diff);
  return today.toISOString().slice(0, 10);
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateMeetingModal({ visible, onClose, onSuccess }: Props) {
  const { data: groups = [] } = useSupportGroups();
  const [selectedGroup, setSelectedGroup] = useState<SupportGroup | null>(null);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  const createMutation = useCreateMeeting(selectedGroup?.id ?? '');

  function handleOpen() {
    const firstGroup = groups[0] ?? null;
    setSelectedGroup(firstGroup);
    setDate(firstGroup ? nextMeetingDate(firstGroup.dayOfWeek) : todayInSaoPaulo());
    setNotes('');
  }

  function handleGroupChange(group: SupportGroup) {
    setSelectedGroup(group);
    setDate(nextMeetingDate(group.dayOfWeek));
  }

  function handleCreate() {
    if (!selectedGroup || !date) return;
    createMutation.mutate(
      { date, notes: notes.trim() || null },
      {
        onSuccess: () => {
          onSuccess();
          onClose();
        },
      },
    );
  }

  return (
      <Modal visible={visible} transparent animationType="slide" onShow={handleOpen}>
        <View className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={onClose} />
          <View className="bg-white rounded-t-3xl" style={{ maxHeight: '80%' }}>
            <View className="px-5 pt-5 pb-3 border-b border-gray-100 flex-row items-center">
              <Text className="flex-1 text-base font-semibold text-gray-900">Nova reunião</Text>
              <Pressable onPress={onClose}>
                <Ionicons name="close" size={20} color="#4b5563" />
              </Pressable>
            </View>

            <ScrollView
              className="px-5"
              contentContainerStyle={{ paddingVertical: 20, gap: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Grupo *</Text>
                {groups.length === 0 ? (
                  <Text className="text-sm text-gray-400">Nenhum grupo cadastrado.</Text>
                ) : (
                  <View className="border border-gray-200 rounded-xl overflow-hidden">
                    {groups.map((g: SupportGroup) => (
                      <TouchableOpacity
                        key={g.id}
                        className={`px-4 py-3 flex-row items-center border-b border-gray-100 ${selectedGroup?.id === g.id ? 'bg-blue-50' : 'bg-white'}`}
                        onPress={() => handleGroupChange(g)}
                      >
                        <View className={`w-4 h-4 rounded-full border-2 mr-3 items-center justify-center ${selectedGroup?.id === g.id ? 'border-blue-500' : 'border-gray-300'}`}>
                          {selectedGroup?.id === g.id && <View className="w-2 h-2 rounded-full bg-blue-500" />}
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm text-gray-900">{g.name}</Text>
                          <Text className="text-xs text-gray-400">
                            {DAY_OF_WEEK_LABELS[g.dayOfWeek]} · {g.churchName}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Data *</Text>
                {/* Story 209: digitável; reunião é agendada, então futuro pode. */}
                <DateInput
                  accessibilityLabel="Data da reunião"
                  value={date}
                  onChange={setDate}
                  error={selectedGroup && !date ? MEETING_DATE_REQUIRED_MESSAGE : undefined}
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Observações (opcional)</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900"
                  placeholder="Ex: Local alternativo, tema especial..."
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={2}
                />
              </View>
            </ScrollView>

            <View className="px-5 py-4 border-t border-gray-100 flex-row gap-3">
              <TouchableOpacity
                className="flex-1 border border-gray-200 rounded-xl py-3 items-center"
                onPress={onClose}
                disabled={createMutation.isPending}
              >
                <Text className="text-sm font-medium text-gray-600">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-blue-600 rounded-xl py-3 items-center"
                onPress={handleCreate}
                disabled={!selectedGroup || !date || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-sm font-medium text-white">Criar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
  );
}

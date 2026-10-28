import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DailyBoardMinistry, DailyPerson } from '@fonte/types';
import { DAILY_LABELS } from '../constants';

interface Props {
  person: DailyPerson | null;
  ministries: Pick<DailyBoardMinistry, 'id' | 'name'>[];
  /** Caixa atual da pessoa (`null` = Sem ministério). */
  currentMinistryId: string | null | undefined;
  onSelect: (person: DailyPerson, toMinistryId: string | null) => void;
  onClose: () => void;
}

/** "Mover para…" (decisão 12): alternativa por toque ao arrasto. */
export function MoveToSheet({ person, ministries, currentMinistryId, onSelect, onClose }: Props) {
  const options: { id: string | null; name: string }[] = [
    { id: null, name: DAILY_LABELS.unassigned },
    ...ministries.map((m) => ({ id: m.id, name: m.name })),
  ];

  return (
    <Modal visible={!!person} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Fechar" />
        <View className="bg-white rounded-t-3xl max-h-[70%]">
          <View className="px-5 pt-5 pb-3 border-b border-gray-100 flex-row items-center">
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900">{DAILY_LABELS.moveTo}</Text>
              {person ? <Text className="text-xs text-gray-500">{person.name}</Text> : null}
            </View>
            <Pressable onPress={onClose} accessibilityLabel="Fechar sheet">
              <Ionicons name="close" size={20} color="#4b5563" />
            </Pressable>
          </View>
          <ScrollView className="px-5" contentContainerClassName="py-3 gap-2">
            {options.map((option) => {
              const current = option.id === (currentMinistryId ?? null);
              return (
                <Pressable
                  key={option.id ?? 'none'}
                  testID={`move-to-${option.id ?? 'none'}`}
                  accessibilityRole="button"
                  disabled={current}
                  onPress={() => person && onSelect(person, option.id)}
                  className={`flex-row items-center rounded-lg border px-4 py-3 ${
                    current ? 'border-blue-200 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <Text className="flex-1 text-sm text-gray-900">{option.name}</Text>
                  {current ? <Ionicons name="checkmark" size={18} color="#2563eb" /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

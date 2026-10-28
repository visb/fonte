import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { IncidentCategory } from '@fonte/types';
import { INCIDENT_CATEGORY_LABELS } from '../constants';

type Props = {
  visible: boolean;
  options: IncidentCategory[];
  value: IncidentCategory | null | undefined;
  onSelect: (category: IncidentCategory) => void;
  onClose: () => void;
};

/** Bottom sheet com as categorias do tipo escolhido (story 230). */
export function IncidentCategoryOptionsModal({ visible, options, value, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-white rounded-t-3xl max-h-[70%]">
          <View className="px-5 pt-5 pb-3 border-b border-gray-100 flex-row items-center">
            <Text className="flex-1 text-base font-semibold text-gray-900">Categoria</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Fechar">
              <Ionicons name="close" size={20} color="#4b5563" />
            </Pressable>
          </View>
          <ScrollView className="px-5" contentContainerClassName="py-4 gap-2" accessibilityRole="radiogroup">
            {options.map((category) => (
              <IncidentCategoryOption
                key={category}
                category={category}
                selected={value === category}
                onPress={() => onSelect(category)}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function IncidentCategoryOption({
  category,
  selected,
  onPress,
}: {
  category: IncidentCategory;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={`incident-category-${category}`}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      className={`flex-row items-center px-4 py-3 rounded-xl border ${
        selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
      }`}
      onPress={onPress}
    >
      <Text className="text-sm text-gray-800 flex-1">{INCIDENT_CATEGORY_LABELS[category]}</Text>
      {selected && <Ionicons name="checkmark" size={18} color="#3b82f6" />}
    </Pressable>
  );
}

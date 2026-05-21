import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHouseStaffForMinistry, useUpdateMinistry } from '../hooks/useMinistries';

interface Props {
  visible: boolean;
  onClose: () => void;
  ministryId: string;
  houseId: string;
  currentLeaderId: string | null;
}

export function LeaderPickerModal({ visible, onClose, ministryId, houseId, currentLeaderId }: Props) {
  const { data: allStaff = [] } = useHouseStaffForMinistry(houseId);
  const updateMinistry = useUpdateMinistry(ministryId, houseId);

  function handleSelect(leaderId: string | null, leaderType: 'STAFF' | null) {
    updateMinistry.mutate({ leaderId, leaderType }, { onSuccess: onClose });
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-white rounded-t-3xl max-h-[60%]">
          <View className="px-5 pt-5 pb-3 border-b border-gray-100 flex-row items-center">
            <Text className="flex-1 text-base font-semibold text-gray-900">Selecionar Líder</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={20} color="#4b5563" />
            </Pressable>
          </View>
          <ScrollView className="px-5" contentContainerClassName="py-4 gap-2">
            <TouchableOpacity
              className="py-3 px-4 rounded-xl border border-gray-200"
              onPress={() => handleSelect(null, null)}
            >
              <Text className="text-sm text-gray-500">— Sem líder</Text>
            </TouchableOpacity>
            {allStaff.map((s) => (
              <TouchableOpacity
                key={s.id}
                className={`py-3 px-4 rounded-xl border ${currentLeaderId === s.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                onPress={() => handleSelect(s.id, 'STAFF')}
              >
                <Text className="text-sm text-gray-900">{s.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

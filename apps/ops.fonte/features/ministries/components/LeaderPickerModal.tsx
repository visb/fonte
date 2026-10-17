import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MinistryLeaderType } from '@fonte/api-client';
import { useMinistryEligibleResidents, useUpdateMinistry } from '../hooks/useMinistries';
import { useHouseStaff } from '@/features/staff/hooks/useHouseStaff';
import { OfflineNotice } from '@/components/shared/OfflineNotice';
import { useIsOnline } from '@/lib/offline/network';
import { LeaderOptions, type LeaderChoice } from './LeaderOptions';

interface Props {
  visible: boolean;
  onClose: () => void;
  ministryId: string;
  houseId: string;
  currentLeaderId: string | null;
  currentLeaderType?: MinistryLeaderType | null;
}

// Story 205: filho em acolhimento da casa volta a poder liderar. Trocar o líder
// exige rede (decisão 9).
export function LeaderPickerModal({
  visible, onClose, ministryId, houseId, currentLeaderId, currentLeaderType = null,
}: Props) {
  const { data: allStaff = [] } = useHouseStaff(houseId);
  const { data: residents = [] } = useMinistryEligibleResidents(visible ? houseId : undefined);
  const updateMinistry = useUpdateMinistry(ministryId, houseId);
  const isOnline = useIsOnline();

  const selected: LeaderChoice | null =
    currentLeaderId && currentLeaderType ? { id: currentLeaderId, type: currentLeaderType } : null;

  function handleSelect(choice: LeaderChoice | null) {
    updateMinistry.mutate(
      { leaderId: choice?.id ?? null, leaderType: choice?.type ?? null },
      { onSuccess: onClose },
    );
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
            {!isOnline && <OfflineNotice message="Precisa de conexão para trocar o líder." />}
            <LeaderOptions
              staff={allStaff}
              residents={residents}
              selected={selected}
              onSelect={handleSelect}
              disabled={!isOnline || updateMinistry.isPending}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

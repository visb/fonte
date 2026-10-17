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
import { useCreateMinistry, useMinistryEligibleResidents } from '../hooks/useMinistries';
import { useHouseStaff } from '@/features/staff/hooks/useHouseStaff';
import { OfflineNotice } from '@/components/shared/OfflineNotice';
import { useIsOnline } from '@/lib/offline/network';
import { LeaderOptions, type LeaderChoice } from './LeaderOptions';

interface Props {
  visible: boolean;
  houseId: string;
  onClose: () => void;
  onSuccess: () => void;
}

// Story 205: líder pode ser servo ou filho em acolhimento na casa. Os filhos
// membros entram depois, pela tela do ministério. Criar exige rede.
export function CreateMinistryModal({ visible, houseId, onClose, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [leader, setLeader] = useState<LeaderChoice | null>(null);
  const isOnline = useIsOnline();

  const { data: allStaff = [] } = useHouseStaff(visible ? houseId : undefined);
  const { data: residents = [] } = useMinistryEligibleResidents(visible ? houseId : undefined);
  const createMutation = useCreateMinistry(houseId);

  function resetForm() {
    setName('');
    setLeader(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleCreate() {
    if (!name.trim()) return;
    createMutation.mutate(
      { name: name.trim(), leaderId: leader?.id ?? null, leaderType: leader?.type ?? null },
      {
        onSuccess: () => {
          resetForm();
          onSuccess();
          onClose();
        },
      },
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={handleClose} />
        <View className="bg-white rounded-t-3xl" style={{ maxHeight: '85%' }}>
          <View className="px-5 pt-5 pb-3 border-b border-gray-100 flex-row items-center">
            <Text className="flex-1 text-base font-semibold text-gray-900">Novo ministério</Text>
            <Pressable onPress={handleClose}>
              <Ionicons name="close" size={20} color="#4b5563" />
            </Pressable>
          </View>

          <ScrollView
            className="px-5"
            contentContainerStyle={{ paddingVertical: 20, gap: 20 }}
            keyboardShouldPersistTaps="handled"
          >
            {!isOnline && <OfflineNotice message="Precisa de conexão para criar um ministério." />}
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1.5">Nome *</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900"
                placeholder="Ex: Cozinha, Horta, Louvor..."
                value={name}
                onChangeText={setName}
                autoFocus
              />
            </View>

            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1.5">Líder (opcional)</Text>
              <LeaderOptions staff={allStaff} residents={residents} selected={leader} onSelect={setLeader} />
            </View>
          </ScrollView>

          <View className="px-5 py-4 border-t border-gray-100 flex-row gap-3">
            <TouchableOpacity
              className="flex-1 border border-gray-200 rounded-xl py-3 items-center"
              onPress={handleClose}
              disabled={createMutation.isPending}
            >
              <Text className="text-sm font-medium text-gray-600">Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-blue-600 rounded-xl py-3 items-center"
              onPress={handleCreate}
              disabled={!isOnline || !name.trim() || createMutation.isPending}
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

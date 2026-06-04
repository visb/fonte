import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { House } from '@fonte/api-client';
import { getErrorMessage } from '@/lib/errors';
import { DatePickerModal } from '@/components/DatePickerModal';
import {
  useDischargeResident,
  useEvadeResident,
  useHouses,
  useTransferResident,
} from '../hooks/useCensus';

type Action = 'discharge' | 'evade' | 'transfer';

function formatDate(iso: string): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

const ACTIONS: { key: Action; label: string; description: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'discharge', label: 'Declarar alta', description: 'Encerrar o acolhimento com alta.', icon: 'exit-outline', color: '#9333ea' },
  { key: 'evade', label: 'Evasão', description: 'Registrar saída por evasão.', icon: 'walk-outline', color: '#dc2626' },
  { key: 'transfer', label: 'Transferir para outra casa', description: 'Mover o filho para outra casa.', icon: 'swap-horizontal-outline', color: '#2563eb' },
];

interface Props {
  visible: boolean;
  houseId: string;
  resident: { id: string; name: string } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function RemoveResidentModal({ visible, houseId, resident, onClose, onSuccess }: Props) {
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [targetHouseId, setTargetHouseId] = useState<string | null>(null);
  const [exitDate, setExitDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const { data: houses = [] } = useHouses();
  const dischargeMutation = useDischargeResident(houseId);
  const evadeMutation = useEvadeResident(houseId);
  const transferMutation = useTransferResident(houseId);

  const isPending = dischargeMutation.isPending || evadeMutation.isPending || transferMutation.isPending;
  const otherHouses = houses.filter((h: House) => h.id !== houseId);

  function handleOpen() {
    setSelectedAction(null);
    setTargetHouseId(null);
    setExitDate(new Date().toISOString().split('T')[0]);
  }

  function done() {
    onSuccess();
    onClose();
  }

  function onError(error: unknown) {
    Alert.alert('Erro', getErrorMessage(error, 'Não foi possível concluir a ação.'));
  }

  function handleConfirm() {
    if (!resident || !selectedAction) return;
    if (selectedAction === 'discharge') {
      dischargeMutation.mutate({ residentId: resident.id, exitDate }, { onSuccess: done, onError });
    } else if (selectedAction === 'evade') {
      evadeMutation.mutate({ residentId: resident.id, exitDate }, { onSuccess: done, onError });
    } else if (selectedAction === 'transfer' && targetHouseId) {
      transferMutation.mutate({ residentId: resident.id, targetHouseId }, { onSuccess: done, onError });
    }
  }

  const needsExitDate = selectedAction === 'discharge' || selectedAction === 'evade';
  const confirmDisabled =
    isPending ||
    !selectedAction ||
    (selectedAction === 'transfer' && !targetHouseId) ||
    (needsExitDate && !exitDate);

  return (
    <>
    <Modal visible={visible} transparent animationType="slide" onShow={handleOpen}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-white rounded-t-3xl" style={{ maxHeight: '85%' }}>
          <View className="px-5 pt-5 pb-3 border-b border-gray-100 flex-row items-center">
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900">Remover filho</Text>
              {resident ? <Text className="text-xs text-gray-400 mt-0.5">{resident.name}</Text> : null}
            </View>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={20} color="#4b5563" />
            </Pressable>
          </View>

          <ScrollView
            className="px-5"
            contentContainerStyle={{ paddingVertical: 16, gap: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            <Text className="text-sm text-gray-500">O que deseja fazer?</Text>
            {ACTIONS.map((action) => {
              const selected = selectedAction === action.key;
              return (
                <TouchableOpacity
                  key={action.key}
                  className={`flex-row items-center rounded-xl border p-3 ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}
                  onPress={() => setSelectedAction(action.key)}
                >
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: `${action.color}20` }}
                  >
                    <Ionicons name={action.icon} size={20} color={action.color} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-900">{action.label}</Text>
                    <Text className="text-xs text-gray-400">{action.description}</Text>
                  </View>
                  {selected ? <Ionicons name="checkmark-circle" size={20} color="#2563eb" /> : null}
                </TouchableOpacity>
              );
            })}

            {needsExitDate ? (
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5 mt-2">Data do acontecimento *</Text>
                <TouchableOpacity
                  className="border border-gray-300 rounded-lg px-3 py-2.5 flex-row items-center justify-between"
                  onPress={() => setDatePickerOpen(true)}
                >
                  <Text className={`text-sm ${exitDate ? 'text-gray-900' : 'text-gray-400'}`}>
                    {exitDate ? formatDate(exitDate) : 'Selecionar data'}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color="#6b7280" />
                </TouchableOpacity>
              </View>
            ) : null}

            {selectedAction === 'transfer' ? (
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5 mt-2">Casa de destino *</Text>
                {otherHouses.length === 0 ? (
                  <Text className="text-sm text-gray-400">Nenhuma outra casa disponível.</Text>
                ) : (
                  <View className="border border-gray-200 rounded-xl overflow-hidden">
                    {otherHouses.map((h: House) => (
                      <TouchableOpacity
                        key={h.id}
                        className={`px-4 py-3 flex-row items-center border-b border-gray-100 ${targetHouseId === h.id ? 'bg-blue-50' : 'bg-white'}`}
                        onPress={() => setTargetHouseId(h.id)}
                      >
                        <View className={`w-4 h-4 rounded-full border-2 mr-3 items-center justify-center ${targetHouseId === h.id ? 'border-blue-500' : 'border-gray-300'}`}>
                          {targetHouseId === h.id ? <View className="w-2 h-2 rounded-full bg-blue-500" /> : null}
                        </View>
                        <Text className="text-sm text-gray-900">{h.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ) : null}
          </ScrollView>

          <View className="px-5 py-4 border-t border-gray-100 flex-row gap-3">
            <TouchableOpacity
              className="flex-1 border border-gray-200 rounded-xl py-3 items-center"
              onPress={onClose}
              disabled={isPending}
            >
              <Text className="text-sm font-medium text-gray-600">Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 rounded-xl py-3 items-center ${confirmDisabled ? 'bg-gray-300' : 'bg-red-600'}`}
              onPress={handleConfirm}
              disabled={confirmDisabled}
            >
              {isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-sm font-medium text-white">Confirmar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    <DatePickerModal
      visible={datePickerOpen}
      value={exitDate}
      onClose={() => setDatePickerOpen(false)}
      onChange={setExitDate}
    />
    </>
  );
}

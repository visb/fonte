import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OfflineNotice } from '@/components/shared/OfflineNotice';
import { ADD_RESIDENT_OFFLINE_MESSAGE } from '../constants';

interface Props {
  confirmedCount: number;
  total: number;
  isOnline: boolean;
  onAdd: () => void;
}

/**
 * Cabeçalho da contagem: progresso + "Adicionar filho". Story 218 (decisão 4):
 * adicionar exige rede, para checar se o filho já passou pela comunidade.
 */
export function CensusHeader({ confirmedCount, total, isOnline, onAdd }: Props) {
  return (
    <>
      <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
        <Text className="text-sm text-gray-500">
          {confirmedCount}/{total} confirmados
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Adicionar filho"
          accessibilityState={{ disabled: !isOnline }}
          className={`flex-row items-center rounded-xl px-3 py-2 ${isOnline ? 'bg-blue-600' : 'bg-gray-300'}`}
          onPress={onAdd}
          disabled={!isOnline}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text className="text-sm font-medium text-white ml-1">Adicionar filho</Text>
        </TouchableOpacity>
      </View>
      {!isOnline ? (
        <View className="px-4 pb-2">
          <OfflineNotice message={ADD_RESIDENT_OFFLINE_MESSAGE} />
        </View>
      ) : null}
    </>
  );
}

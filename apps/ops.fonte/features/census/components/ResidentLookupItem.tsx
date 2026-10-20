import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatIsoDateBr, type ResidentLookupItem as LookupCandidate } from '@fonte/types';
import { resolveAssetUrl } from '@/lib/api';
import { LOOKUP_STATUS_LABELS } from '../constants';

interface Props {
  candidate: LookupCandidate;
  /** Sem `onPress` vira resumo somente leitura (tela de confirmação). */
  onPress?: () => void;
}

/** Story 218 — candidato a reacolhimento: foto, nome, nascimento, última casa e saída. */
export function ResidentLookupItem({ candidate, onPress }: Props) {
  const photo = resolveAssetUrl(candidate.photoUrl);
  const details = [
    candidate.birthDate ? `Nasc. ${formatIsoDateBr(candidate.birthDate)}` : null,
    candidate.lastHouseName ? `Última casa: ${candidate.lastHouseName}` : null,
    candidate.lastExitDate ? `Saída: ${formatIsoDateBr(candidate.lastExitDate)}` : null,
  ].filter(Boolean);

  return (
    <TouchableOpacity
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Candidato ${candidate.name}`}
      disabled={!onPress}
      onPress={onPress}
      className="bg-white border border-gray-200 rounded-xl px-3 py-3 flex-row items-center"
    >
      <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-3 overflow-hidden">
        {photo ? (
          <Image source={{ uri: photo }} className="w-10 h-10 rounded-full" />
        ) : (
          <Ionicons name="person-outline" size={20} color="#2563eb" />
        )}
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-gray-900">{candidate.name}</Text>
        {details.length ? (
          <Text className="text-xs text-gray-500 mt-0.5">{details.join(' · ')}</Text>
        ) : null}
      </View>
      <View className="bg-gray-100 rounded-full px-2 py-0.5 ml-2">
        <Text className="text-[10px] font-medium text-gray-600">
          {LOOKUP_STATUS_LABELS[candidate.status] ?? candidate.status}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

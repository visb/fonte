import { Image, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DailyPerson } from '@fonte/types';
import { resolveAssetUrl } from '@/lib/api';
import { multipleMinistriesLabel, personInitials } from '../constants';
import { DailyRankBadge } from './DailyRankBadge';

interface Props {
  person: DailyPerson;
  /** Card flutuando durante o arrasto (sombra/realce). */
  floating?: boolean;
}

/** Foto + nome; badge só para servo; aviso de "estava em N ministérios". */
export function DailyPersonCard({ person, floating = false }: Props) {
  const photo = resolveAssetUrl(person.photoThumbUrl);
  const extra = person.hadMultipleMinistries ? person.currentMinistryIds.length : 0;
  return (
    <View
      className={`flex-row items-center bg-white rounded-lg border px-3 py-2 ${
        floating ? 'border-blue-400 shadow-lg' : 'border-gray-100'
      }`}
    >
      <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center mr-2 overflow-hidden">
        {photo ? (
          <Image testID="daily-person-photo" source={{ uri: photo }} className="w-8 h-8 rounded-full" />
        ) : (
          <Text className="text-xs font-semibold text-blue-600">{personInitials(person.name)}</Text>
        )}
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center flex-wrap gap-2">
          <Text className="text-sm text-gray-900" numberOfLines={1}>
            {person.name}
          </Text>
          <DailyRankBadge person={person} />
        </View>
        {extra > 1 ? (
          <View className="flex-row items-center gap-1">
            <Ionicons name="information-circle-outline" size={12} color="#b45309" />
            <Text className="text-[11px] text-amber-700">{multipleMinistriesLabel(extra)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

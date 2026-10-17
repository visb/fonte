import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ServantRank } from '@fonte/types';
import { ServantRankBadge } from '@/components/shared/ServantRankBadge';

const THEME = '#272950';

interface Props {
  displayName?: string;
  photoUrl: string | null;
  subtitle?: string;
  /** Story 207: nível do servo logado; nulo (ou modo Resident) → sem badge. */
  rank?: ServantRank | null;
  isPhotoUploading: boolean;
  onPickPhoto: () => void;
}

export function ProfileHeader({ displayName, photoUrl, subtitle, rank, isPhotoUploading, onPickPhoto }: Props) {
  return (
    <View style={{ backgroundColor: THEME }} className="pt-4 pb-12 items-center">
      <Pressable onPress={onPickPhoto} className="relative">
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            className="w-24 h-24 rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
          />
        ) : (
          <View
            className="w-24 h-24 rounded-full items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
          >
            <Ionicons name="person" size={44} color="#fff" />
          </View>
        )}
        <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white items-center justify-center shadow">
          {isPhotoUploading ? (
            <ActivityIndicator size="small" color={THEME} />
          ) : (
            <Ionicons name="camera" size={16} color={THEME} />
          )}
        </View>
      </Pressable>
      <Text className="text-white text-xl font-bold mt-3">{displayName}</Text>
      {rank ? (
        <View className="mt-1">
          <ServantRankBadge rank={rank} />
        </View>
      ) : null}
      {subtitle ? <Text className="text-white/70 text-sm">{subtitle}</Text> : null}
    </View>
  );
}

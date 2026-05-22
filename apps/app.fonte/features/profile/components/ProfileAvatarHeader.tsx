import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RelativeMe } from '@fonte/api-client';

interface Props {
  me: RelativeMe;
  photoUrl: string | null;
  uploading: boolean;
  onPickPhoto: () => void;
}

export function ProfileAvatarHeader({ me, photoUrl, uploading, onPickPhoto }: Props) {
  return (
    <View className="bg-violet-700 pt-8 pb-12 items-center">
      <Pressable onPress={onPickPhoto} className="relative">
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} className="w-24 h-24 rounded-full bg-violet-500" />
        ) : (
          <View className="w-24 h-24 rounded-full bg-violet-500 items-center justify-center">
            <Ionicons name="person" size={44} color="#fff" />
          </View>
        )}
        <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white items-center justify-center shadow">
          {uploading ? (
            <ActivityIndicator size="small" color="#7c3aed" />
          ) : (
            <Ionicons name="camera" size={16} color="#7c3aed" />
          )}
        </View>
      </Pressable>
      <Text className="text-white text-xl font-bold mt-3">{me.name}</Text>
      {me.relationship && (
        <Text className="text-violet-200 text-sm">{me.relationship}</Text>
      )}
    </View>
  );
}

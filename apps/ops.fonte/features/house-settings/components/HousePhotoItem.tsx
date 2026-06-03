import { Alert, Image, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { HousePhoto } from '@fonte/api-client';
import { resolveAssetUrl } from '@/lib/api';

interface Props {
  photo: HousePhoto;
  onRemove: (photoId: string) => void;
  isRemoving: boolean;
}

export function HousePhotoItem({ photo, onRemove, isRemoving }: Props) {
  function confirmRemove() {
    Alert.alert('Remover foto', 'Deseja remover esta foto da casa?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => onRemove(photo.id) },
    ]);
  }

  return (
    <View className="w-[31%] aspect-square rounded-xl overflow-hidden bg-gray-100">
      <Image
        source={{ uri: resolveAssetUrl(photo.url) ?? undefined }}
        className="w-full h-full"
        resizeMode="cover"
      />
      <TouchableOpacity
        onPress={confirmRemove}
        disabled={isRemoving}
        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 items-center justify-center"
      >
        <Ionicons name="trash-outline" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

import { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { resolveAssetUrl } from '@/lib/api';

interface Props {
  name: string;
  photoUrl?: string | null;
  photoThumbUrl?: string | null;
}

export function ResidentPhoto({ name, photoUrl, photoThumbUrl }: Props) {
  const [open, setOpen] = useState(false);
  const thumbUrl = resolveAssetUrl(photoThumbUrl ?? photoUrl);
  const fullUrl = resolveAssetUrl(photoUrl ?? photoThumbUrl);

  return (
    <View className="items-center py-4">
      <TouchableOpacity
        disabled={!fullUrl}
        onPress={() => setOpen(true)}
        className="w-24 h-24 rounded-full bg-blue-50 items-center justify-center overflow-hidden"
      >
        {thumbUrl ? (
          <Image source={{ uri: thumbUrl }} className="w-24 h-24 rounded-full" />
        ) : (
          <Ionicons name="person-outline" size={40} color="#2563eb" />
        )}
      </TouchableOpacity>

      {fullUrl && (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable
            className="flex-1 bg-black/90 items-center justify-center"
            onPress={() => setOpen(false)}
          >
            <Image
              source={{ uri: fullUrl }}
              className="w-full h-2/3"
              resizeMode="contain"
            />
            <TouchableOpacity
              onPress={() => setOpen(false)}
              className="absolute top-12 right-6 p-2"
            >
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
            <Text className="text-white text-base mt-4">{name}</Text>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

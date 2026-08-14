import { useState } from 'react';
import { Image, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { resolveAssetUrl } from '@/lib/api';
import { ResidentPhotoViewer } from './ResidentPhotoViewer';

interface Props {
  name: string;
  photoUrl?: string | null;
  photoThumbUrl?: string | null;
}

/** Avatar da ficha do filho. O expansor mora no `ResidentPhotoViewer` (story 179). */
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

      <ResidentPhotoViewer
        visible={open}
        name={name}
        photoUrl={photoUrl}
        photoThumbUrl={photoThumbUrl}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

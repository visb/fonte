import { Alert, Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

export interface PickedPhoto {
  uri: string;
  type: string;
}

interface Props {
  photo: PickedPhoto | null;
  onChange: (photo: PickedPhoto) => void;
}

/** Foto opcional do filho, escolhida da galeria. */
export function AddResidentPhotoPicker({ photo, onChange }: Props) {
  async function handlePick() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria para adicionar a foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    onChange({ uri: asset.uri, type: asset.mimeType ?? 'image/jpeg' });
  }

  return (
    <View className="items-center">
      <TouchableOpacity
        className="w-24 h-24 rounded-full bg-gray-100 items-center justify-center overflow-hidden border border-gray-200"
        onPress={handlePick}
      >
        {photo ? (
          <Image source={{ uri: photo.uri }} className="w-24 h-24 rounded-full" />
        ) : (
          <Ionicons name="camera-outline" size={28} color="#9ca3af" />
        )}
      </TouchableOpacity>
      <Text className="text-xs text-gray-400 mt-2">Foto (opcional)</Text>
    </View>
  );
}

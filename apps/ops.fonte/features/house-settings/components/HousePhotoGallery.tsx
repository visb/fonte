import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import type { House } from '@fonte/api-client';
import { getErrorMessage } from '@/lib/errors';
import { useAddHousePhoto, useRemoveHousePhoto } from '../hooks/useHouseSettings';
import { HousePhotoItem } from './HousePhotoItem';

const THEME = '#272950';

interface Props {
  house: House;
}

export function HousePhotoGallery({ house }: Props) {
  const addPhoto = useAddHousePhoto(house.id);
  const removePhoto = useRemoveHousePhoto(house.id);

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria para adicionar fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    addPhoto.mutate(
      { uri: asset.uri, type: asset.mimeType ?? 'image/jpeg' },
      { onError: (err) => Alert.alert('Erro', getErrorMessage(err, 'Não foi possível adicionar a foto.')) },
    );
  }

  function handleRemove(photoId: string) {
    removePhoto.mutate(photoId, {
      onError: (err) => Alert.alert('Erro', getErrorMessage(err, 'Não foi possível remover a foto.')),
    });
  }

  const photos = house.photos ?? [];

  return (
    <View className="bg-white rounded-2xl shadow-sm p-4">
      <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Fotos da casa
      </Text>

      {photos.length === 0 ? (
        <Text className="text-sm text-gray-400 mb-4">Nenhuma foto adicionada.</Text>
      ) : (
        <View className="flex-row flex-wrap gap-[3.5%] mb-4">
          {photos.map((photo) => (
            <HousePhotoItem
              key={photo.id}
              photo={photo}
              onRemove={handleRemove}
              isRemoving={removePhoto.isPending}
            />
          ))}
        </View>
      )}

      <TouchableOpacity
        className="rounded-lg py-3 items-center flex-row justify-center gap-2"
        style={{ backgroundColor: THEME }}
        onPress={handlePickPhoto}
        disabled={addPhoto.isPending}
      >
        {addPhoto.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="image-outline" size={18} color="#fff" />
            <Text className="text-white font-semibold text-base">Adicionar foto</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

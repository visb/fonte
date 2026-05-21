import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { resolveAssetUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useUploadStaffPhoto, useUploadResidentPhoto } from '../hooks/useProfile';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileDataSection } from '../components/ProfileDataSection';
import { ChangePasswordSection } from '../components/ChangePasswordSection';

export function ProfilePage() {
  const { staff, resident, isResident, refreshStaff, refreshResident } = useAuth();
  const uploadStaffPhoto = useUploadStaffPhoto();
  const uploadResidentPhoto = useUploadResidentPhoto();

  const displayName = isResident ? resident?.name : staff?.name;
  const photoUrl = isResident
    ? resolveAssetUrl(resident?.photoUrl ?? null)
    : resolveAssetUrl(staff?.photoUrl ?? null);
  const subtitle = isResident ? 'Filho' : (staff?.house?.name ?? staff?.supportGroup?.name ?? '');
  const isPhotoUploading = isResident ? uploadResidentPhoto.isPending : uploadStaffPhoto.isPending;

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria para alterar sua foto.');
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

    if (isResident) {
      uploadResidentPhoto.mutate(
        { uri: asset.uri, type: asset.mimeType ?? 'image/jpeg' },
        {
          onSuccess: () => refreshResident(),
          onError: () => Alert.alert('Erro', 'Não foi possível atualizar a foto.'),
        },
      );
    } else {
      uploadStaffPhoto.mutate(
        { uri: asset.uri, type: asset.mimeType ?? 'image/jpeg' },
        {
          onSuccess: () => refreshStaff(),
          onError: () => Alert.alert('Erro', 'Não foi possível atualizar a foto.'),
        },
      );
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <ProfileHeader
          displayName={displayName}
          photoUrl={photoUrl}
          subtitle={subtitle}
          isPhotoUploading={isPhotoUploading}
          onPickPhoto={handlePickPhoto}
        />

        <View className="px-4 -mt-5 space-y-4">
          {!isResident && staff && (
            <ProfileDataSection staff={staff} onRefresh={refreshStaff} />
          )}
          <ChangePasswordSection />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

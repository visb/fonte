import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { useRelativeMe } from '@/features/home/hooks/useRelativeMe';
import { useUploadProfilePhoto } from '../hooks/useProfile';
import { ProfileAvatarHeader } from '../components/ProfileAvatarHeader';
import { ProfileDataForm } from '../components/ProfileDataForm';
import { PasswordChangeForm } from '../components/PasswordChangeForm';

export function ProfilePage() {
  const { refreshRelative } = useAuth();
  const { data: me, isLoading, isError, refetch } = useRelativeMe();
  const uploadPhoto = useUploadProfilePhoto();

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
    uploadPhoto.mutate(
      { uri: asset.uri, type: asset.mimeType ?? 'image/jpeg' },
      {
        onSuccess: () => refreshRelative(),
        onError: () => Alert.alert('Erro', 'Não foi possível atualizar a foto.'),
      },
    );
  }

  if (isLoading) return <LoadingState />;
  if (isError || !me) return <ErrorState onRetry={refetch} />;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <ProfileAvatarHeader
          me={me}
          photoUrl={api.photoUrl(me.photoUrl ?? null)}
          uploading={uploadPhoto.isPending}
          onPickPhoto={handlePickPhoto}
        />
        <View className="px-4 -mt-5 space-y-4">
          <ProfileDataForm
            defaultValues={{ name: me.name, phone: me.phone ?? '' }}
            onSuccess={refreshRelative}
          />
          <PasswordChangeForm />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
          <Pressable
            onPress={() => router.push('/(app)/privacy' as Href)}
            className="flex-row items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"
          >
            <Ionicons name="shield-checkmark-outline" size={20} color="#7c3aed" />
            <Text className="flex-1 text-sm font-medium text-gray-900">Privacidade e consentimentos</Text>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

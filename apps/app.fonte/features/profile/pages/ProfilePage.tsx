import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { useRelativeMe } from '@/features/home/hooks/useRelativeMe';
import { useUpdateProfile, useUploadProfilePhoto } from '../hooks/useProfile';

const profileSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().optional().or(z.literal('')),
});
type ProfileForm = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'As senhas não coincidem',
    path: ['confirm'],
  });
type PasswordForm = z.infer<typeof passwordSchema>;

const INPUT_CLASS =
  'border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50';

export function ProfilePage() {
  const { changePassword, refreshRelative } = useAuth();
  const { data: me, isLoading, isError, refetch } = useRelativeMe();
  const updateProfile = useUpdateProfile();
  const uploadPhoto = useUploadProfilePhoto();
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    if (me) {
      profileForm.reset({ name: me.name, phone: me.phone ?? '' });
    }
  }, [me]);

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

  const onSaveProfile = (data: ProfileForm) => {
    setProfileError('');
    setProfileSuccess(false);
    updateProfile.mutate(
      { name: data.name, phone: data.phone || null },
      {
        onSuccess: () => {
          setProfileSuccess(true);
          refreshRelative();
          setTimeout(() => setProfileSuccess(false), 3000);
        },
        onError: (err) => setProfileError(getErrorMessage(err, 'Erro ao salvar.')),
      },
    );
  };

  const onChangePassword = async (data: PasswordForm) => {
    setPasswordError('');
    setPasswordSuccess(false);
    try {
      await changePassword(data.password);
      setPasswordSuccess(true);
      passwordForm.reset();
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setPasswordError(getErrorMessage(err, 'Erro ao alterar senha.'));
    }
  };

  if (isLoading) return <LoadingState />;
  if (isError || !me) return <ErrorState onRetry={refetch} />;

  const photoUrl = api.photoUrl(me.photoUrl ?? null);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Avatar header */}
        <View className="bg-violet-700 pt-8 pb-12 items-center">
          <Pressable onPress={handlePickPhoto} className="relative">
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                className="w-24 h-24 rounded-full bg-violet-500"
              />
            ) : (
              <View className="w-24 h-24 rounded-full bg-violet-500 items-center justify-center">
                <Ionicons name="person" size={44} color="#fff" />
              </View>
            )}
            <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white items-center justify-center shadow">
              {uploadPhoto.isPending ? (
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

        <View className="px-4 -mt-5 space-y-4">
          {/* Edit profile */}
          <View className="bg-white rounded-2xl shadow-sm p-4">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Meus dados
            </Text>

            <View className="space-y-3">
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Nome</Text>
                <Controller
                  control={profileForm.control}
                  name="name"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className={INPUT_CLASS}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      autoCapitalize="words"
                    />
                  )}
                />
                {profileForm.formState.errors.name && (
                  <Text className="text-sm text-red-600 mt-1">
                    {profileForm.formState.errors.name.message}
                  </Text>
                )}
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Telefone</Text>
                <Controller
                  control={profileForm.control}
                  name="phone"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className={INPUT_CLASS}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="phone-pad"
                      placeholder="(11) 99999-9999"
                    />
                  )}
                />
              </View>

              {profileError ? (
                <Text className="text-sm text-red-600">{profileError}</Text>
              ) : null}
              {profileSuccess ? (
                <Text className="text-sm text-green-600">Dados salvos com sucesso!</Text>
              ) : null}

              <TouchableOpacity
                className="bg-violet-600 rounded-lg py-3 items-center mt-1"
                onPress={profileForm.handleSubmit(onSaveProfile)}
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold text-base">Salvar dados</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Change password */}
          <View className="bg-white rounded-2xl shadow-sm p-4">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Alterar senha
            </Text>

            <View className="space-y-3">
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Nova senha</Text>
                <Controller
                  control={passwordForm.control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className={INPUT_CLASS}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      secureTextEntry
                      placeholder="••••••••"
                    />
                  )}
                />
                {passwordForm.formState.errors.password && (
                  <Text className="text-sm text-red-600 mt-1">
                    {passwordForm.formState.errors.password.message}
                  </Text>
                )}
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Confirmar senha</Text>
                <Controller
                  control={passwordForm.control}
                  name="confirm"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className={INPUT_CLASS}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      secureTextEntry
                      placeholder="••••••••"
                    />
                  )}
                />
                {passwordForm.formState.errors.confirm && (
                  <Text className="text-sm text-red-600 mt-1">
                    {passwordForm.formState.errors.confirm.message}
                  </Text>
                )}
              </View>

              {passwordError ? (
                <Text className="text-sm text-red-600">{passwordError}</Text>
              ) : null}
              {passwordSuccess ? (
                <Text className="text-sm text-green-600">Senha alterada com sucesso!</Text>
              ) : null}

              <TouchableOpacity
                className="bg-violet-600 rounded-lg py-3 items-center mt-1"
                onPress={passwordForm.handleSubmit(onChangePassword)}
                disabled={passwordForm.formState.isSubmitting}
              >
                {passwordForm.formState.isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold text-base">Alterar senha</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

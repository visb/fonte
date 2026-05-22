import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm';

export default function ChangePasswordScreen() {
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-2xl font-bold text-gray-900 mb-2">Trocar senha</Text>
        <Text className="text-base text-gray-500 mb-8">Crie uma nova senha para sua conta.</Text>
        <ChangePasswordForm onSuccess={() => router.replace('/(app)')} />
      </View>
    </KeyboardAvoidingView>
  );
}

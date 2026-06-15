import { useEffect } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { LoginForm } from '@/features/auth/components/LoginForm';

export default function LoginScreen() {
  const { token } = useAuth();

  // Recuperação: havendo token (inclusive logo após definir a senha no primeiro acesso),
  // manda para a home. Evita o familiar ficar preso no login se o (app)/_layout fez bounce.
  useEffect(() => {
    if (token) router.replace('/(app)');
  }, [token]);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-gray-900 mb-1">app.fonte</Text>
        <Text className="text-base text-gray-500 mb-10">Portal do familiar</Text>
        <LoginForm
          onSuccess={() => router.replace('/(app)')}
          onMustChangePassword={() => router.replace('/(auth)/change-password')}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

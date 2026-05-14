import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth, MustChangePasswordError } from '@/lib/auth';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});
type FormData = z.infer<typeof schema>;

export default function LoginScreen() {
  const { login } = useAuth();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.email, data.password);
      router.replace('/(app)');
    } catch (err) {
      if (err instanceof MustChangePasswordError) {
        router.replace('/(auth)/change-password');
      } else {
        setError('root', { message: 'E-mail ou senha incorretos.' });
      }
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-gray-900 mb-1">app.fonte</Text>
        <Text className="text-base text-gray-500 mb-10">Portal do familiar</Text>

        <View className="space-y-4">
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1.5">E-mail</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50"
                  placeholder="seu@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />
            {errors.email && <Text className="text-sm text-red-600 mt-1">{errors.email.message}</Text>}
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1.5">Senha</Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50"
                  placeholder="••••••••"
                  secureTextEntry
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  onSubmitEditing={handleSubmit(onSubmit)}
                />
              )}
            />
            {errors.password && <Text className="text-sm text-red-600 mt-1">{errors.password.message}</Text>}
          </View>

          {errors.root && <Text className="text-sm text-red-600">{errors.root.message}</Text>}

          <TouchableOpacity
            className="bg-violet-600 rounded-lg py-3.5 items-center mt-2"
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">Entrar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

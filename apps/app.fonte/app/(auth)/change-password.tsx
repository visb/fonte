import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';

const schema = z.object({
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'As senhas não coincidem.',
  path: ['confirm'],
});
type FormData = z.infer<typeof schema>;

export default function ChangePasswordScreen() {
  const { changePassword } = useAuth();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await changePassword(data.password);
      router.replace('/(app)');
    } catch {
      setError('root', { message: 'Erro ao alterar senha. Tente novamente.' });
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-2xl font-bold text-gray-900 mb-2">Trocar senha</Text>
        <Text className="text-base text-gray-500 mb-8">Crie uma nova senha para sua conta.</Text>

        <View className="space-y-4">
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1.5">Nova senha</Text>
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
                />
              )}
            />
            {errors.password && <Text className="text-sm text-red-600 mt-1">{errors.password.message}</Text>}
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1.5">Confirmar senha</Text>
            <Controller
              control={control}
              name="confirm"
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
            {errors.confirm && <Text className="text-sm text-red-600 mt-1">{errors.confirm.message}</Text>}
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
              <Text className="text-white font-semibold text-base">Salvar senha</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

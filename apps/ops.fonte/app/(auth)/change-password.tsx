import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { passwordSchema, type PasswordForm } from '@/lib/passwordSchema';
import { PasswordInput } from '@/components/shared/PasswordInput';

const INPUT_CLASS = 'border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50';

export default function ChangePasswordScreen() {
  const { changePassword } = useAuth();

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  async function onSubmit(data: PasswordForm) {
    try {
      await changePassword(data.password);
      router.replace('/(app)');
    } catch {
      setError('root', { message: 'Não foi possível alterar a senha. Tente novamente.' });
    }
  }

  const submit = handleSubmit(onSubmit);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-gray-900 mb-1">Definir senha</Text>
        <Text className="text-base text-gray-500 mb-10">
          Este é seu primeiro acesso. Crie uma senha para continuar.
        </Text>

        <View className="space-y-4">
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1.5">Nova senha</Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <PasswordInput
                  accessibilityLabel="input-nova-senha"
                  className={INPUT_CLASS}
                  placeholder="••••••••"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />
            {errors.password && (
              <Text className="text-sm text-red-600 mt-1">{errors.password.message}</Text>
            )}
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1.5">Confirmar senha</Text>
            <Controller
              control={control}
              name="confirm"
              render={({ field: { onChange, onBlur, value } }) => (
                <PasswordInput
                  accessibilityLabel="input-confirmar-senha"
                  className={INPUT_CLASS}
                  placeholder="••••••••"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  onSubmitEditing={submit}
                />
              )}
            />
            {errors.confirm && (
              <Text className="text-sm text-red-600 mt-1">{errors.confirm.message}</Text>
            )}
          </View>

          {errors.root && <Text className="text-sm text-red-600">{errors.root.message}</Text>}

          <TouchableOpacity
            className="bg-blue-600 rounded-lg py-3.5 items-center mt-2"
            onPress={submit}
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

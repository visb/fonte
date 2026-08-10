import { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { passwordSchema, type PasswordForm } from '@/lib/passwordSchema';
import { PasswordInput } from '@/components/shared/PasswordInput';

const THEME = '#272950';
const INPUT_CLASS = 'border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50';

export function ChangePasswordSection() {
  const { changePassword } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  async function onChangePassword(data: PasswordForm) {
    setError('');
    setSuccess(false);
    try {
      await changePassword(data.password);
      setSuccess(true);
      reset();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao alterar senha.'));
    }
  }

  return (
    <View className="bg-white rounded-2xl shadow-sm p-4">
      <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Alterar senha
      </Text>

      <View className="space-y-3">
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Nova senha</Text>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <PasswordInput className={INPUT_CLASS} value={value} onChangeText={onChange} onBlur={onBlur} placeholder="••••••••" />
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
              <PasswordInput className={INPUT_CLASS} value={value} onChangeText={onChange} onBlur={onBlur} placeholder="••••••••" />
            )}
          />
          {errors.confirm && <Text className="text-sm text-red-600 mt-1">{errors.confirm.message}</Text>}
        </View>

        {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
        {success ? <Text className="text-sm text-green-600">Senha alterada com sucesso!</Text> : null}

        <TouchableOpacity
          className="rounded-lg py-3 items-center mt-1"
          style={{ backgroundColor: THEME }}
          onPress={handleSubmit(onChangePassword)}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Alterar senha</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

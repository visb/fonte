import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getErrorMessage } from '@/lib/errors';
import { useAuth } from '@/lib/auth';

const schema = z
  .object({
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'As senhas não coincidem',
    path: ['confirm'],
  });
type FormValues = z.infer<typeof schema>;

const INPUT_CLASS = 'border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50';

export function PasswordChangeForm() {
  const { changePassword } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormValues) {
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
          {errors.confirm && (
            <Text className="text-sm text-red-600 mt-1">{errors.confirm.message}</Text>
          )}
        </View>

        {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
        {success ? (
          <Text className="text-sm text-green-600">Senha alterada com sucesso!</Text>
        ) : null}

        <TouchableOpacity
          className="bg-violet-600 rounded-lg py-3 items-center mt-1"
          onPress={handleSubmit(onSubmit)}
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

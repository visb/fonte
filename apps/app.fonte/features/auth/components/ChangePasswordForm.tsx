import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/auth';

const schema = z
  .object({
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'As senhas não coincidem.',
    path: ['confirm'],
  });
type FormData = z.infer<typeof schema>;

const INPUT_CLASS = 'border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50';

interface Props {
  onSuccess: () => void;
}

export function ChangePasswordForm({ onSuccess }: Props) {
  const { changePassword } = useAuth();
  const { control, handleSubmit, setError, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    try {
      await changePassword(data.password);
      onSuccess();
    } catch {
      setError('root', { message: 'Erro ao alterar senha. Tente novamente.' });
    }
  }

  return (
    <View className="space-y-4">
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-1.5">Nova senha</Text>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className={INPUT_CLASS}
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
              className={INPUT_CLASS}
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
  );
}

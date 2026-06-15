import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth, MustChangePasswordError } from '@/lib/auth';

const schema = z.object({
  identifier: z.string().min(1, 'Informe e-mail ou telefone'),
  password: z.string().min(1, 'Senha é obrigatória'),
});
type FormData = z.infer<typeof schema>;

const INPUT_CLASS = 'border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50';

interface Props {
  onSuccess: () => void;
  onMustChangePassword: () => void;
}

export function LoginForm({ onSuccess, onMustChangePassword }: Props) {
  const { login } = useAuth();
  const { control, handleSubmit, setError, setValue, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    try {
      await login(data.identifier, data.password);
      onSuccess();
    } catch (err) {
      if (err instanceof MustChangePasswordError) {
        onMustChangePassword();
      } else {
        setError('root', { message: 'E-mail ou senha incorretos.' });
      }
    }
  }

  return (
    <View className="space-y-4">
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-1.5">E-mail ou telefone</Text>
        <Controller
          control={control}
          name="identifier"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              accessibilityLabel="input-email"
              className={INPUT_CLASS}
              placeholder="seu@email.com ou telefone"
              autoCapitalize="none"
              autoCorrect={false}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />
        {errors.identifier && <Text className="text-sm text-red-600 mt-1">{errors.identifier.message}</Text>}
      </View>

      <View>
        <Text className="text-sm font-medium text-gray-700 mb-1.5">Senha</Text>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              accessibilityLabel="input-senha"
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
        {errors.password && <Text className="text-sm text-red-600 mt-1">{errors.password.message}</Text>}
      </View>

      {errors.root && <Text className="text-sm text-red-600">{errors.root.message}</Text>}

      {__DEV__ && (
        <View className="flex-row justify-center gap-4">
          <TouchableOpacity
            accessibilityLabel="fill-test-credentials"
            onPress={() => { setValue('identifier', 'familiar@fonte.com'); setValue('password', 'familiar123'); }}
          >
            <Text className="text-xs text-gray-400">teste válido</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="fill-test-credentials-invalid"
            onPress={() => { setValue('identifier', 'familiar@fonte.com'); setValue('password', 'senha_errada'); }}
          >
            <Text className="text-xs text-gray-400">teste inválido</Text>
          </TouchableOpacity>
        </View>
      )}

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
  );
}

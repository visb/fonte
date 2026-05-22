import { useState, useEffect } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getErrorMessage } from '@/lib/errors';
import { useUpdateProfile } from '../hooks/useProfile';

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().optional().or(z.literal('')),
});
export type ProfileDataFormValues = z.infer<typeof schema>;

const INPUT_CLASS = 'border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50';

interface Props {
  defaultValues: ProfileDataFormValues;
  onSuccess: () => void;
}

export function ProfileDataForm({ defaultValues, onSuccess }: Props) {
  const updateProfile = useUpdateProfile();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { control, handleSubmit, setValue, reset, formState: { errors } } = useForm<ProfileDataFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues.name, defaultValues.phone]);

  function onSubmit(data: ProfileDataFormValues) {
    setError('');
    setSuccess(false);
    updateProfile.mutate(
      { name: data.name, phone: data.phone || null },
      {
        onSuccess: () => {
          setSuccess(true);
          onSuccess();
          setTimeout(() => setSuccess(false), 8000);
        },
        onError: (err) => setError(getErrorMessage(err, 'Erro ao salvar.')),
      },
    );
  }

  return (
    <View className="bg-white rounded-2xl shadow-sm p-4">
      <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Meus dados
      </Text>

      <View className="space-y-3">
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Nome</Text>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                accessibilityLabel="input-nome"
                className={INPUT_CLASS}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="words"
              />
            )}
          />
          {errors.name && (
            <Text className="text-sm text-red-600 mt-1">{errors.name.message}</Text>
          )}
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Telefone</Text>
          <Controller
            control={control}
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

        {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
        {success ? (
          <Text accessibilityLabel="profile-save-success" className="text-sm text-green-600">
            Dados salvos com sucesso!
          </Text>
        ) : null}

        {__DEV__ && (
          <>
            <TouchableOpacity
              accessibilityLabel="fill-test-profile-name"
              onPress={() => setValue('name', 'Maria Testadora Editada')}
              style={{ width: 44, height: 44, opacity: 0.01 }}
            />
            <TouchableOpacity
              accessibilityLabel="fill-test-profile-name-reset"
              onPress={() => setValue('name', 'Maria Testadora')}
              style={{ width: 44, height: 44, opacity: 0.01 }}
            />
          </>
        )}

        <TouchableOpacity
          className="bg-violet-600 rounded-lg py-3 items-center mt-1"
          onPress={handleSubmit(onSubmit)}
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
  );
}

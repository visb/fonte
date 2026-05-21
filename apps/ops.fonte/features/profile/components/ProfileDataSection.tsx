import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { StaffMe } from '@fonte/api-client';
import { getErrorMessage } from '@/lib/errors';
import { useUpdateStaffProfile } from '../hooks/useProfile';

const THEME = '#272950';
const INPUT_CLASS = 'border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50';

const profileSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
});
type ProfileForm = z.infer<typeof profileSchema>;

interface Props {
  staff: StaffMe;
  onRefresh: () => void;
}

export function ProfileDataSection({ staff, onRefresh }: Props) {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const updateProfile = useUpdateStaffProfile();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    reset({ name: staff.name, phone: staff.phone ?? '', email: staff.user.email });
  }, [staff, reset]);

  function onSave(data: ProfileForm) {
    setError('');
    setSuccess(false);
    updateProfile.mutate(
      { name: data.name, phone: data.phone || null, email: data.email || undefined },
      {
        onSuccess: () => {
          setSuccess(true);
          onRefresh();
          setTimeout(() => setSuccess(false), 3000);
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
              <TextInput className={INPUT_CLASS} value={value} onChangeText={onChange} onBlur={onBlur} autoCapitalize="words" />
            )}
          />
          {errors.name && <Text className="text-sm text-red-600 mt-1">{errors.name.message}</Text>}
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Telefone</Text>
          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput className={INPUT_CLASS} value={value} onChangeText={onChange} onBlur={onBlur} keyboardType="phone-pad" placeholder="(11) 99999-9999" />
            )}
          />
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">E-mail</Text>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput className={INPUT_CLASS} value={value} onChangeText={onChange} onBlur={onBlur} keyboardType="email-address" autoCapitalize="none" />
            )}
          />
          {errors.email && <Text className="text-sm text-red-600 mt-1">{errors.email.message}</Text>}
        </View>

        {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
        {success ? <Text className="text-sm text-green-600">Dados salvos com sucesso!</Text> : null}

        <TouchableOpacity
          className="rounded-lg py-3 items-center mt-1"
          style={{ backgroundColor: THEME }}
          onPress={handleSubmit(onSave)}
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

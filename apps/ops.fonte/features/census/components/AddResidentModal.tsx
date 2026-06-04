import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Gender, ResidentStatus } from '@fonte/types';
import { getErrorMessage } from '@/lib/errors';
import { DatePickerModal } from '@/components/DatePickerModal';
import { useCreateCensusResident } from '../hooks/useCensus';

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome'),
  entryDate: z.string().min(1, 'Informe a data de acolhimento'),
  birthDate: z.string().optional(),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  gender: z.nativeEnum(Gender),
  nationality: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const todayIso = () => new Date().toISOString().split('T')[0];

const buildDefaults = (): FormValues => ({
  name: '',
  entryDate: todayIso(),
  birthDate: '',
  cpf: '',
  rg: '',
  gender: Gender.MALE,
  nationality: 'Brasileira',
});

function formatDate(iso: string): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

interface Props {
  visible: boolean;
  houseId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddResidentModal({ visible, houseId, onClose, onSuccess }: Props) {
  const [photo, setPhoto] = useState<{ uri: string; type: string } | null>(null);
  const [activeDatePicker, setActiveDatePicker] = useState<'entry' | 'birth' | null>(null);
  const createMutation = useCreateCensusResident(houseId);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: buildDefaults(),
  });

  function handleOpen() {
    reset(buildDefaults());
    setPhoto(null);
  }

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria para adicionar a foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPhoto({ uri: asset.uri, type: asset.mimeType ?? 'image/jpeg' });
  }

  function onSubmit(values: FormValues) {
    createMutation.mutate(
      {
        data: {
          name: values.name.trim(),
          houseId,
          status: ResidentStatus.ACTIVE,
          entryDate: values.entryDate,
          gender: values.gender,
          birthDate: values.birthDate || null,
          cpf: values.cpf?.trim() || null,
          rg: values.rg?.trim() || null,
          nationality: values.nationality?.trim() || null,
        },
        photo: photo ?? undefined,
      },
      {
        onSuccess: () => {
          onSuccess();
          onClose();
        },
        onError: (error) => Alert.alert('Erro', getErrorMessage(error, 'Não foi possível adicionar o filho.')),
      },
    );
  }

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onShow={handleOpen}>
        <View className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={onClose} />
          <View className="bg-white rounded-t-3xl" style={{ maxHeight: '90%' }}>
            <View className="px-5 pt-5 pb-3 border-b border-gray-100 flex-row items-center">
              <Text className="flex-1 text-base font-semibold text-gray-900">Adicionar filho</Text>
              <Pressable onPress={onClose}>
                <Ionicons name="close" size={20} color="#4b5563" />
              </Pressable>
            </View>

            <ScrollView
              className="px-5"
              contentContainerStyle={{ paddingVertical: 20, gap: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              <View className="items-center">
                <TouchableOpacity
                  className="w-24 h-24 rounded-full bg-gray-100 items-center justify-center overflow-hidden border border-gray-200"
                  onPress={handlePickPhoto}
                >
                  {photo ? (
                    <Image source={{ uri: photo.uri }} className="w-24 h-24 rounded-full" />
                  ) : (
                    <Ionicons name="camera-outline" size={28} color="#9ca3af" />
                  )}
                </TouchableOpacity>
                <Text className="text-xs text-gray-400 mt-2">Foto (opcional)</Text>
              </View>

              <Field label="Nome *" error={errors.name?.message}>
                <Controller
                  control={control}
                  name="name"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextInput
                      className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900"
                      placeholder="Nome completo"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                    />
                  )}
                />
              </Field>

              <Controller
                control={control}
                name="entryDate"
                render={({ field: { value, onChange } }) => (
                  <Field label="Data de acolhimento *" error={errors.entryDate?.message}>
                    <TouchableOpacity
                      className="border border-gray-300 rounded-lg px-3 py-2.5 flex-row items-center justify-between"
                      onPress={() => setActiveDatePicker('entry')}
                    >
                      <Text className={`text-sm ${value ? 'text-gray-900' : 'text-gray-400'}`}>
                        {value ? formatDate(value) : 'Selecionar data'}
                      </Text>
                      <Ionicons name="calendar-outline" size={18} color="#6b7280" />
                    </TouchableOpacity>
                    <DatePickerModal
                      visible={activeDatePicker === 'entry'}
                      value={value ?? ''}
                      onClose={() => setActiveDatePicker(null)}
                      onChange={onChange}
                    />
                  </Field>
                )}
              />

              <Controller
                control={control}
                name="birthDate"
                render={({ field: { value, onChange } }) => (
                  <Field label="Data de nascimento">
                    <TouchableOpacity
                      className="border border-gray-300 rounded-lg px-3 py-2.5 flex-row items-center justify-between"
                      onPress={() => setActiveDatePicker('birth')}
                    >
                      <Text className={`text-sm ${value ? 'text-gray-900' : 'text-gray-400'}`}>
                        {value ? formatDate(value) : 'Selecionar data'}
                      </Text>
                      <Ionicons name="calendar-outline" size={18} color="#6b7280" />
                    </TouchableOpacity>
                    <DatePickerModal
                      visible={activeDatePicker === 'birth'}
                      value={value ?? ''}
                      onClose={() => setActiveDatePicker(null)}
                      onChange={onChange}
                    />
                  </Field>
                )}
              />

              <Field label="CPF">
                <Controller
                  control={control}
                  name="cpf"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextInput
                      className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900"
                      placeholder="000.000.000-00"
                      keyboardType="number-pad"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                    />
                  )}
                />
              </Field>

              <Field label="RG">
                <Controller
                  control={control}
                  name="rg"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextInput
                      className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900"
                      placeholder="Número do RG"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                    />
                  )}
                />
              </Field>

              <Field label="Gênero">
                <Controller
                  control={control}
                  name="gender"
                  render={({ field: { value, onChange } }) => (
                    <View className="flex-row gap-3">
                      <GenderOption
                        label="Masculino"
                        selected={value === Gender.MALE}
                        onPress={() => onChange(Gender.MALE)}
                      />
                      <GenderOption
                        label="Feminino"
                        selected={value === Gender.FEMALE}
                        onPress={() => onChange(Gender.FEMALE)}
                      />
                    </View>
                  )}
                />
              </Field>

              <Field label="Nacionalidade">
                <Controller
                  control={control}
                  name="nationality"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <TextInput
                      className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900"
                      placeholder="Brasileira"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                    />
                  )}
                />
              </Field>
            </ScrollView>

            <View className="px-5 py-4 border-t border-gray-100 flex-row gap-3">
              <TouchableOpacity
                className="flex-1 border border-gray-200 rounded-xl py-3 items-center"
                onPress={onClose}
                disabled={createMutation.isPending}
              >
                <Text className="text-sm font-medium text-gray-600">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-blue-600 rounded-xl py-3 items-center"
                onPress={handleSubmit(onSubmit)}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-sm font-medium text-white">Adicionar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text className="text-sm font-medium text-gray-700 mb-1.5">{label}</Text>
      {children}
      {error ? <Text className="text-xs text-red-600 mt-1">{error}</Text> : null}
    </View>
  );
}

function GenderOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className={`flex-1 rounded-xl border py-2.5 items-center ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}
      onPress={onPress}
    >
      <Text className={`text-sm font-medium ${selected ? 'text-blue-600' : 'text-gray-600'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

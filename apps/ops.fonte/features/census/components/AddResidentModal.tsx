import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { maskCpfInput, normalizeCpf } from '@fonte/types';
import { getErrorMessage } from '@/lib/errors';
import { useFieldSubmit } from '@/lib/offline/fieldSubmit';
import { useCensusAddResident } from '../hooks/useCensus';
import {
  addResidentSchema,
  buildAddResidentDefaults,
  type AddResidentFormValues,
} from '../lib/addResidentSchema';
import { AddResidentDateFields } from './AddResidentDateFields';
import { AddResidentField } from './AddResidentField';
import { AddResidentPhotoPicker, type PickedPhoto } from './AddResidentPhotoPicker';
import { AddResidentTextField } from './AddResidentTextField';
import { GenderSelector } from './GenderSelector';

interface Props {
  visible: boolean;
  houseId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddResidentModal({ visible, houseId, onClose, onSuccess }: Props) {
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const createMutation = useCensusAddResident(houseId);
  const submit = useFieldSubmit(createMutation);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<AddResidentFormValues>({
    resolver: zodResolver(addResidentSchema),
    defaultValues: buildAddResidentDefaults(),
  });

  function handleOpen() {
    reset(buildAddResidentDefaults());
    setPhoto(null);
  }

  function onSubmit(values: AddResidentFormValues) {
    function done() {
      onSuccess();
      onClose();
    }

    // Payload igual ao de antes da story 209: datas ISO, mesma mutationKey.
    submit(
      {
        data: {
          name: values.name.trim(),
          houseId,
          entryDate: values.entryDate,
          gender: values.gender,
          birthDate: values.birthDate || null,
          // Story 219: CPF só com dígitos (a máscara é só de digitação).
          cpf: normalizeCpf(values.cpf),
          rg: values.rg?.trim() || null,
          nationality: values.nationality?.trim() || null,
        },
        photo: photo ?? undefined,
      },
      {
        onSent: done,
        // Contagem no pátio, sem sinal: o filho entra na fila (com a foto
        // encadeada, story 169) e o modal fecha na hora — segurar o operador
        // aqui é o que faria o lançamento se perder (story 171).
        onQueued: () => {
          done();
          Alert.alert(
            'Salvo no aparelho',
            'Sem conexão agora: o filho será enviado assim que a conexão voltar.',
          );
        },
        // Rejeição na hora (ex.: 409 de CPF em uso — "Já existe um filho com
        // este CPF: <nome> (<status>)."). Se já estava na fila, o mesmo erro
        // vai para /sync pela outbox (story 219, decisão 11).
        onFailed: (error) =>
          Alert.alert('Erro', getErrorMessage(error, 'Não foi possível adicionar o filho.')),
      },
    );
  }

  return (
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
            <AddResidentPhotoPicker photo={photo} onChange={setPhoto} />
            <AddResidentTextField
              control={control}
              name="name"
              label="Nome *"
              placeholder="Nome completo"
              error={errors.name?.message}
            />
            <AddResidentDateFields control={control} errors={errors} setValue={setValue} />
            <AddResidentTextField
              control={control}
              name="cpf"
              label="CPF"
              placeholder="000.000.000-00"
              keyboardType="number-pad"
              mask={maskCpfInput}
              error={errors.cpf?.message}
            />
            <AddResidentTextField control={control} name="rg" label="RG" placeholder="Número do RG" />
            <AddResidentField label="Gênero">
              <Controller
                control={control}
                name="gender"
                render={({ field: { value, onChange } }) => (
                  <GenderSelector value={value} onChange={onChange} />
                )}
              />
            </AddResidentField>
            <AddResidentTextField
              control={control}
              name="nationality"
              label="Nacionalidade"
              placeholder="Brasileira"
            />
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
  );
}

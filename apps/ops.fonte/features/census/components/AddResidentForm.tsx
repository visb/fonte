import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { maskCpfInput, normalizeCpf } from '@fonte/types';
import { getCpfConflict, getErrorMessage } from '@/lib/errors';
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
  houseId: string;
  /** Story 218: o que foi digitado na busca ("Não é nenhum destes"). */
  prefill?: { name?: string; cpf?: string };
  onCancel: () => void;
  /** Enviado ou na fila: o modal fecha e a contagem recarrega. */
  onDone: () => void;
  /** Story 218 (decisão 7): 409 de CPF em uso — o modal oferece reacolher o dono. */
  onCpfConflict: (conflict: { message: string; conflictResidentId: string | null }, cpf: string) => void;
}

/** Cadastro novo da contagem (formulário de antes da story 218, sem mudanças de regra). */
export function AddResidentForm({ houseId, prefill, onCancel, onDone, onCpfConflict }: Props) {
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const createMutation = useCensusAddResident(houseId);
  const submit = useFieldSubmit(createMutation);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<AddResidentFormValues>({
    resolver: zodResolver(addResidentSchema),
    defaultValues: {
      ...buildAddResidentDefaults(),
      name: prefill?.name ?? '',
      cpf: prefill?.cpf ? maskCpfInput(prefill.cpf) : '',
    },
  });

  function onSubmit(values: AddResidentFormValues) {
    const cpf = normalizeCpf(values.cpf);
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
          cpf,
          rg: values.rg?.trim() || null,
          nationality: values.nationality?.trim() || null,
        },
        photo: photo ?? undefined,
      },
      {
        onSent: onDone,
        // Contagem no pátio, sem sinal: o filho entra na fila (com a foto
        // encadeada, story 169) e o modal fecha na hora (story 171).
        onQueued: () => {
          onDone();
          Alert.alert(
            'Salvo no aparelho',
            'Sem conexão agora: o filho será enviado assim que a conexão voltar.',
          );
        },
        // Rejeição na hora. Se já estava na fila, o mesmo erro vai para /sync
        // pela outbox (story 219, decisão 11).
        onFailed: (error) => {
          const conflict = getCpfConflict(error);
          if (conflict && cpf) return onCpfConflict(conflict, cpf);
          Alert.alert('Erro', getErrorMessage(error, 'Não foi possível adicionar o filho.'));
        },
      },
    );
  }

  return (
    <>
      <ScrollView
        className="px-5"
        contentContainerStyle={{ paddingVertical: 20, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <AddResidentPhotoPicker photo={photo} onChange={setPhoto} />
        <AddResidentTextField control={control} name="name" label="Nome *" placeholder="Nome completo" error={errors.name?.message} />
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
            render={({ field: { value, onChange } }) => <GenderSelector value={value} onChange={onChange} />}
          />
        </AddResidentField>
        <AddResidentTextField control={control} name="nationality" label="Nacionalidade" placeholder="Brasileira" />
      </ScrollView>

      <View className="px-5 py-4 border-t border-gray-100 flex-row gap-3">
        <TouchableOpacity
          className="flex-1 border border-gray-200 rounded-xl py-3 items-center"
          onPress={onCancel}
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
    </>
  );
}

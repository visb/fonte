import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { notify } from '@/lib/dialogs';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { todayInSaoPaulo, type ResidentLookupItem as LookupCandidate } from '@fonte/types';
import { DateInput } from '@/components/shared/DateInput';
import { getErrorMessage } from '@/lib/errors';
import { useFieldSubmit } from '@/lib/offline/fieldSubmit';
import { useCensusReadmit } from '../hooks/useCensus';
import { buildReadmitDefaults, buildReadmitSchema, type ReadmitFormValues } from '../lib/readmitSchema';
import { AddResidentField } from './AddResidentField';
import { ResidentLookupItem } from './ResidentLookupItem';

interface Props {
  houseId: string;
  candidate: LookupCandidate;
  onBack: () => void;
  /** Reacolhimento enviado (ou na fila): o modal fecha. */
  onDone: () => void;
}

/**
 * Story 218 — confirma o reacolhimento: cadastro somente leitura + data de
 * entrada (não futura, ≥ última saída). Saúde, peso e plano ficam para o adm.
 */
export function ReadmitConfirmStep({ houseId, candidate, onBack, onDone }: Props) {
  const readmit = useCensusReadmit(houseId);
  const submit = useFieldSubmit(readmit);
  const schema = useMemo(() => buildReadmitSchema(candidate.lastExitDate), [candidate.lastExitDate]);
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ReadmitFormValues>({ resolver: zodResolver(schema), defaultValues: buildReadmitDefaults() });

  function onSubmit(values: ReadmitFormValues) {
    submit(
      { residentId: candidate.id, residentName: candidate.name, entryDate: values.entryDate },
      {
        onSent: onDone,
        // Sinal caiu depois de entrar no fluxo: o reacolhimento vai para a fila.
        onQueued: () => {
          onDone();
          notify(
            'Salvo no aparelho',
            'Sem conexão agora: o reacolhimento será enviado assim que a conexão voltar.',
          );
        },
        onFailed: (error) =>
          notify('Erro', getErrorMessage(error, 'Não foi possível reacolher o filho.')),
      },
    );
  }

  return (
    <>
      <ScrollView className="px-5" contentContainerStyle={{ paddingVertical: 20, gap: 16 }}>
        <Text className="text-sm text-gray-600">
          O filho volta para esta casa com o mesmo cadastro (familiares, documentos e histórico).
        </Text>
        <ResidentLookupItem candidate={candidate} />
        <AddResidentField label="Data de entrada *">
          <Controller
            control={control}
            name="entryDate"
            render={({ field: { value, onChange, onBlur } }) => (
              <DateInput
                accessibilityLabel="Data de entrada"
                value={value ?? ''}
                onChange={onChange}
                onBlur={onBlur}
                onInvalidChange={(invalid) => setValue('entryDateInvalid', invalid)}
                minDate={candidate.lastExitDate ?? undefined}
                maxDate={todayInSaoPaulo()}
                error={errors.entryDate?.message}
              />
            )}
          />
        </AddResidentField>
      </ScrollView>

      <View className="px-5 py-4 border-t border-gray-100 flex-row gap-3">
        <TouchableOpacity
          className="flex-1 border border-gray-200 rounded-xl py-3 items-center"
          onPress={onBack}
          disabled={readmit.isPending}
        >
          <Text className="text-sm font-medium text-gray-600">Voltar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-blue-600 rounded-xl py-3 items-center"
          onPress={handleSubmit(onSubmit)}
          disabled={readmit.isPending}
        >
          {readmit.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-sm font-medium text-white">Reacolher</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );
}

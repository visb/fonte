import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ResidentLookupItem as LookupCandidate } from '@fonte/types';
import { lookupSearchSchema, type LookupSearchValues } from '../lib/readmitSchema';
import { AddResidentField } from './AddResidentField';
import { ResidentLookupResults } from './ResidentLookupResults';

interface Props {
  onSelect: (candidate: LookupCandidate) => void;
  /** Recebe o que foi digitado, para pré-preencher o cadastro novo. */
  onNotFound: (term: string) => void;
  onBack: () => void;
}

/**
 * Story 218 — busca do cadastro de quem já passou pela comunidade, por nome ou
 * CPF, na comunidade inteira (só quem está fora de acolhimento).
 */
export function ResidentLookupStep({ onSelect, onNotFound, onBack }: Props) {
  // Termo confirmado no "Buscar" (não é campo de formulário: é o que foi enviado).
  const [searched, setSearched] = useState('');
  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LookupSearchValues>({
    resolver: zodResolver(lookupSearchSchema),
    defaultValues: { term: '' },
  });

  const search = handleSubmit((values) => setSearched(values.term.trim()));

  return (
    <>
      <ScrollView
        className="px-5"
        contentContainerStyle={{ paddingVertical: 20, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <AddResidentField label="Nome ou CPF" error={errors.term?.message}>
          <View className="flex-row gap-2">
            <Controller
              control={control}
              name="term"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  accessibilityLabel="Nome ou CPF"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900"
                  placeholder="Ex.: João da Silva ou 000.000.000-00"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  onSubmitEditing={search}
                  returnKeyType="search"
                />
              )}
            />
            <TouchableOpacity
              accessibilityRole="button"
              className="bg-blue-600 rounded-lg px-4 items-center justify-center"
              onPress={search}
            >
              <Text className="text-sm font-medium text-white">Buscar</Text>
            </TouchableOpacity>
          </View>
        </AddResidentField>

        {searched ? (
          <ResidentLookupResults
            term={searched}
            onSelect={onSelect}
            onNotFound={() => onNotFound(getValues('term'))}
          />
        ) : null}
      </ScrollView>

      <View className="px-5 py-4 border-t border-gray-100">
        <TouchableOpacity
          className="border border-gray-200 rounded-xl py-3 items-center"
          onPress={onBack}
        >
          <Text className="text-sm font-medium text-gray-600">Voltar</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

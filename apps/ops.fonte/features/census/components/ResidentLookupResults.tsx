import { Text, TouchableOpacity, View } from 'react-native';
import type { ResidentLookupItem as LookupCandidate } from '@fonte/types';
import { getErrorMessage } from '@/lib/errors';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { useResidentLookup } from '../hooks/useCensus';
import { ResidentLookupItem } from './ResidentLookupItem';

interface Props {
  /** Termo já confirmado pelo operador (botão Buscar). */
  term: string;
  onSelect: (candidate: LookupCandidate) => void;
  /** Nenhum resultado ou "Não é nenhum destes" → cadastro novo. */
  onNotFound: () => void;
}

/** Story 218 — estados da busca de candidatos (carregando, erro, vazio, lista). */
export function ResidentLookupResults({ term, onSelect, onNotFound }: Props) {
  const { data, isLoading, error, refetch } = useResidentLookup(term);

  if (isLoading) return <LoadingState />;
  if (error) {
    return (
      <ErrorState
        message={getErrorMessage(error, 'Não foi possível buscar agora.')}
        onRetry={refetch}
      />
    );
  }

  const candidates = data ?? [];
  const newResidentButton = (label: string) => (
    <TouchableOpacity
      accessibilityRole="button"
      className="border border-gray-200 rounded-xl py-3 items-center mt-2"
      onPress={onNotFound}
    >
      <Text className="text-sm font-medium text-gray-700">{label}</Text>
    </TouchableOpacity>
  );

  if (!candidates.length) {
    return (
      <EmptyState message="Nenhum cadastro encontrado fora de acolhimento.">
        {newResidentButton('Cadastrar como novo')}
      </EmptyState>
    );
  }

  return (
    <View className="gap-2">
      <Text className="text-xs text-gray-500">Toque no cadastro do filho para reacolher.</Text>
      {candidates.map((candidate) => (
        <ResidentLookupItem
          key={candidate.id}
          candidate={candidate}
          onPress={() => onSelect(candidate)}
        />
      ))}
      {newResidentButton('Não é nenhum destes')}
    </View>
  );
}

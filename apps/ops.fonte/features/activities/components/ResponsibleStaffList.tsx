import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ResponsibleOptions } from './ResponsibleOptions';

interface Person {
  id: string;
  name: string;
}

interface Props {
  query: {
    data?: Person[];
    isLoading: boolean;
    error: unknown;
    refetch: () => unknown;
  };
  currentId: string | null;
  onSelect: (staffId: string) => void;
  disabled?: boolean;
}

/**
 * Estados da lista de servos do seletor de responsável (story 224 — extraído do
 * `SelectResponsibleModal`): carregando, erro com tentar de novo, casa vazia ou
 * as opções.
 */
export function ResponsibleStaffList({ query, currentId, onSelect, disabled }: Props) {
  const staff = query.data ?? [];
  if (query.isLoading) return <LoadingState />;
  if (query.error) {
    return <ErrorState message="Erro ao carregar os servos." onRetry={query.refetch} />;
  }
  if (staff.length === 0) return <EmptyState message="Nenhum servo na casa." />;
  return (
    <ResponsibleOptions
      staff={staff}
      currentId={currentId}
      onSelect={onSelect}
      disabled={disabled}
    />
  );
}

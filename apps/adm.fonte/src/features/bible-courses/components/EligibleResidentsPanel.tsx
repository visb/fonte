import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import { useEligibleResidents, useEnrollBulk } from '../hooks/useBibleCourses';
import { EligibleResidentRow } from './EligibleResidentRow';

interface Props {
  classId: string;
  /** Ids already enrolled in this class — hidden from the suggestions. */
  enrolledIds: string[];
  /** When false the query stays idle (e.g. class already has enrollments). */
  enabled?: boolean;
}

export function EligibleResidentsPanel({ classId, enrolledIds, enabled = true }: Props) {
  const { data, isLoading, isError, refetch } = useEligibleResidents({ enabled });
  const enrollMutation = useEnrollBulk(classId);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const enrolledSet = new Set(enrolledIds);
  const eligible = (data ?? []).filter((r) => !enrolledSet.has(r.id));

  // Marca todos por padrão sempre que a lista de elegíveis muda.
  useEffect(() => {
    setSelected(new Set(eligible.map((r) => r.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!enabled) return null;
  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (eligible.length === 0) return <EmptyState title="Nenhum filho elegível." />;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleEnroll = () => {
    if (selected.size === 0) return;
    enrollMutation.mutate([...selected]);
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-primary" />
        <h2 className="text-sm font-semibold">Sugestões de matrícula</h2>
        <span className="text-xs text-muted-foreground">
          Filhos com 3+ meses de casa e sem turma
        </span>
      </div>

      <div className="space-y-1 max-h-96 overflow-y-auto">
        {eligible.map((r) => (
          <EligibleResidentRow
            key={r.id}
            resident={r}
            checked={selected.has(r.id)}
            onToggle={toggle}
          />
        ))}
      </div>

      {enrollMutation.error && (
        <p className="text-xs text-destructive">
          {getErrorMessage(enrollMutation.error, 'Erro ao matricular.')}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={selected.size === 0 || enrollMutation.isPending}
          onClick={handleEnroll}
        >
          Matricular selecionados ({selected.size})
        </Button>
      </div>
    </div>
  );
}

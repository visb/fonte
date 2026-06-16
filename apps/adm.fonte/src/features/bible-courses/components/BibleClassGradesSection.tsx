import type { UpsertBibleGradeInput } from '@fonte/api-client';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { getErrorMessage } from '@/lib/errors';
import { useBibleClassGrades, useUpsertBibleGrade } from '../hooks/useBibleGrades';
import { BibleGradesTable } from './BibleGradesTable';

interface Props {
  classId: string;
}

export function BibleClassGradesSection({ classId }: Props) {
  const { data: grades, isLoading, isError, refetch } = useBibleClassGrades(classId);
  const upsert = useUpsertBibleGrade(classId);

  if (isLoading) return <LoadingState />;
  if (isError || !grades) return <ErrorState onRetry={() => refetch()} />;

  if (grades.rows.length === 0) {
    return <EmptyState title="Matricule filhos para lançar notas." />;
  }
  if (grades.modules.length === 0) {
    return (
      <EmptyState
        title="Nenhum módulo no catálogo."
        description="Cadastre módulos em Curso Bíblico › Módulos para lançar notas."
      />
    );
  }

  function handleSave(enrollmentId: string, moduleId: string, data: UpsertBibleGradeInput) {
    upsert.mutate({ enrollmentId, moduleId, data });
  }

  return (
    <div className="space-y-2">
      <BibleGradesTable grades={grades} disabled={upsert.isPending} onSave={handleSave} />
      {upsert.isError && (
        <p className="text-xs text-destructive">
          {getErrorMessage(upsert.error, 'Erro ao salvar nota.')}
        </p>
      )}
    </div>
  );
}

import { useState } from 'react';
import type { BibleClassGradeModuleColumn } from '@fonte/api-client';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { useBibleClassGrades, useUpsertBibleGradesBulk } from '../hooks/useBibleGrades';
import { BibleGradesTable } from './BibleGradesTable';
import { BibleModuleGradesDialog, type ModuleGradeChange } from './BibleModuleGradesDialog';

interface Props {
  classId: string;
}

export function BibleClassGradesSection({ classId }: Props) {
  const { data: grades, isLoading, isError, refetch } = useBibleClassGrades(classId);
  const bulkUpsert = useUpsertBibleGradesBulk(classId);
  const [selectedModule, setSelectedModule] = useState<BibleClassGradeModuleColumn | null>(null);

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

  const closeDialog = () => {
    setSelectedModule(null);
    bulkUpsert.reset();
  };

  const handleSave = (changes: ModuleGradeChange[]) => {
    if (!selectedModule) return;
    if (changes.length === 0) {
      closeDialog();
      return;
    }
    bulkUpsert.mutate(
      { moduleId: selectedModule.id, changes },
      { onSuccess: closeDialog },
    );
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Clique no módulo para lançar ou editar as notas dos filhos.
      </p>
      <BibleGradesTable grades={grades} onSelectModule={setSelectedModule} />
      <BibleModuleGradesDialog
        open={!!selectedModule}
        module={selectedModule}
        rows={grades.rows}
        isPending={bulkUpsert.isPending}
        error={bulkUpsert.error}
        onClose={closeDialog}
        onSave={handleSave}
      />
    </div>
  );
}

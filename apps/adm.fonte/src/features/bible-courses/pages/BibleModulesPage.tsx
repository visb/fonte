import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import type { BibleCourseModule } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useBibleModules, useDeleteBibleModule } from '../hooks/useBibleModules';
import { BibleModuleRow } from '../components/BibleModuleRow';
import { BibleModuleDialog } from '../components/BibleModuleDialog';

export function BibleModulesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BibleCourseModule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BibleCourseModule | null>(null);

  const { data: modules = [], isLoading, isError, refetch } = useBibleModules();
  const deleteMutation = useDeleteBibleModule();

  const nextSequence = modules.reduce((max, m) => Math.max(max, m.sequence), -1) + 1;

  const openCreate = () => { setEditTarget(null); setDialogOpen(true); };
  const openEdit = (m: BibleCourseModule) => { setEditTarget(m); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditTarget(null); };

  return (
    <div className="max-w-2xl space-y-6">
      <Link to="/bible-courses" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> Voltar
      </Link>

      <PageHeader
        title="Módulos do curso bíblico"
        description="Catálogo de módulos reutilizado por todas as turmas."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} className="mr-1.5" />
            Novo módulo
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : modules.length === 0 ? (
        <EmptyState title="Nenhum módulo cadastrado." />
      ) : (
        <div className="space-y-2">
          {modules.map((m) => (
            <BibleModuleRow key={m.id} module={m} onEdit={openEdit} onDelete={setDeleteTarget} />
          ))}
        </div>
      )}

      <BibleModuleDialog
        open={dialogOpen}
        module={editTarget}
        nextSequence={nextSequence}
        onClose={closeDialog}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir módulo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

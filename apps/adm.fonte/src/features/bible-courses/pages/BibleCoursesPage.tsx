import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Plus } from 'lucide-react';
import { Role } from '@fonte/types';
import type { BibleCourseClass } from '@fonte/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useBibleClasses, useDeleteBibleClass } from '../hooks/useBibleCourses';
import { BibleClassCard } from '../components/BibleClassCard';
import { BibleClassDialog } from '../components/BibleClassDialog';

export function BibleCoursesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BibleCourseClass | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BibleCourseClass | null>(null);

  const { role } = useAuth();
  const isAdmin = role === Role.ADMIN;
  const { data: classes = [], isLoading, isError, refetch } = useBibleClasses();
  const deleteMutation = useDeleteBibleClass();

  // A new class opens right after the most recent one ends.
  const latestEndDate = classes.reduce<string | undefined>(
    (max, c) => (!max || c.endDate > max ? c.endDate : max),
    undefined,
  );

  const openCreate = () => { setEditTarget(null); setDialogOpen(true); };
  const openEdit = (k: BibleCourseClass) => { setEditTarget(k); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditTarget(null); };

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Curso Bíblico"
        description="Turmas do curso bíblico e matrículas dos filhos."
        actions={
          <div className="flex gap-2">
            {isAdmin && (
              <Button asChild size="sm" variant="outline">
                <Link to="/bible-courses/modules">
                  <BookOpen size={14} className="mr-1.5" />
                  Módulos
                </Link>
              </Button>
            )}
            <Button size="sm" onClick={openCreate}>
              <Plus size={14} className="mr-1.5" />
              Nova turma
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : classes.length === 0 ? (
        <EmptyState title="Nenhuma turma cadastrada." />
      ) : (
        <div className="space-y-2">
          {classes.map((k) => (
            <BibleClassCard key={k.id} klass={k} onEdit={openEdit} onDelete={setDeleteTarget} />
          ))}
        </div>
      )}

      <BibleClassDialog
        open={dialogOpen}
        klass={editTarget}
        defaultStartDate={editTarget ? undefined : latestEndDate}
        onClose={closeDialog}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir turma</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Todas as matrículas serão removidas.
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

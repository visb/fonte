import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { Staff } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useStaff, useDeleteStaff } from '../hooks/useStaff';
import { ResetPasswordDialog } from '../components/ResetPasswordDialog';
import { StaffCard } from '../components/StaffCard';

export function StaffPage() {
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const [resetTarget, setResetTarget] = useState<Staff | null>(null);

  const { data: staff = [], isLoading, isError, refetch } = useStaff();
  const deleteMutation = useDeleteStaff();

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title="Servos"
        actions={
          <Button asChild>
            <Link to="/staff/new">
              <Plus size={16} className="mr-2" />
              Novo Servo
            </Link>
          </Button>
        }
      />

      {staff.length === 0 ? (
        <EmptyState title="Nenhum servo cadastrado." />
      ) : (
        <div className="space-y-3">
          {staff.map((s) => (
            <StaffCard
              key={s.id}
              staff={s}
              onEdit={() => navigate(`/staff/${s.id}/edit`)}
              onResetPassword={() => setResetTarget(s)}
              onDelete={() => setDeleteTarget(s)}
            />
          ))}
        </div>
      )}

      <ResetPasswordDialog
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        staff={resetTarget}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Servo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? O acesso ao sistema será revogado.
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

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, CalendarDays, Pencil, Plus, Trash2, User } from 'lucide-react';
import { api } from '@/lib/api';
import type { Resident } from '@fonte/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useResidents, useDeleteResident } from '../hooks/useResidents';
import { RESIDENT_STATUS_LABELS, RESIDENT_STATUS_VARIANT } from '../constants';

function formatLocalDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function computeAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const [y, m, d] = birthDate.split('T')[0].split('-').map(Number);
  let age = today.getFullYear() - y;
  const monthDiff = today.getMonth() + 1 - m;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) age--;
  return age;
}

function ResidentAvatar({ url, name }: { url: string | null; name: string }) {
  const src = api.photoUrl(url);
  return (
    <div className="w-10 h-10 rounded-full border bg-muted flex items-center justify-center shrink-0 overflow-hidden">
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <User size={18} className="text-muted-foreground" />
      )}
    </div>
  );
}

function ResidentRow({
  resident,
  onEdit,
  onDelete,
}: {
  resident: Resident;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  const age = computeAge(resident.birthDate);

  return (
    <div
      className="flex w-full items-center gap-4 rounded-lg border bg-card px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={() => navigate(`/residents/${resident.id}`)}
    >
      <ResidentAvatar url={resident.photoUrl} name={resident.name} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{resident.name}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
          {resident.house && (
            <span className="flex items-center gap-1">
              <Building2 size={13} />
              {resident.house.name}
            </span>
          )}
          {resident.entryDate && (
            <span className="flex items-center gap-1">
              <CalendarDays size={13} />
              {formatLocalDate(resident.entryDate)}
            </span>
          )}
          {age != null && <span>{age} anos</span>}
        </div>
      </div>
      <Badge variant={RESIDENT_STATUS_VARIANT[resident.status]}>
        {RESIDENT_STATUS_LABELS[resident.status]}
      </Badge>
      <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" onClick={onEdit} title="Editar">
          <Pencil size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
          title="Excluir"
        >
          <Trash2 size={16} />
        </Button>
      </div>
    </div>
  );
}

export function ResidentsPage() {
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<Resident | null>(null);

  const { data: residents = [], isLoading, isError, refetch } = useResidents();
  const deleteMutation = useDeleteResident();

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title="Filhos"
        actions={
          <Button asChild>
            <Link to="/residents/new">
              <Plus size={16} className="mr-2" />
              Novo acolhimento
            </Link>
          </Button>
        }
      />

      {residents.length === 0 ? (
        <EmptyState title="Nenhum acolhido cadastrado." />
      ) : (
        <div className="space-y-3">
          {residents.map((resident) => (
            <ResidentRow
              key={resident.id}
              resident={resident}
              onEdit={() => navigate(`/residents/${resident.id}/edit`)}
              onDelete={() => setDeleteTarget(resident)}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir acolhido</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

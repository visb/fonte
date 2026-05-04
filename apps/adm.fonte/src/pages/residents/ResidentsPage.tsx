import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CalendarDays, Pencil, Plus, Trash2, User } from 'lucide-react';
import { ResidentStatus } from '@fonte/types';
import { api, photoUrl } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

interface Resident {
  id: string;
  name: string;
  birthDate: string | null;
  status: ResidentStatus;
  house: { id: string; name: string };
  entryDate: string | null;
  photoUrl: string | null;
}

const STATUS_LABELS: Record<ResidentStatus, string> = {
  [ResidentStatus.PRE_ADMISSION]: 'Pré-admissão',
  [ResidentStatus.ACTIVE]: 'Ativo',
  [ResidentStatus.DISCIPLINE]: 'Disciplina',
  [ResidentStatus.TEMP_LEAVE]: 'Saída temporária',
  [ResidentStatus.DISCHARGED]: 'Alta',
  [ResidentStatus.EVADED]: 'Evasão',
};

const STATUS_VARIANT: Record<
  ResidentStatus,
  'secondary' | 'success' | 'warning' | 'info' | 'purple' | 'destructive'
> = {
  [ResidentStatus.PRE_ADMISSION]: 'secondary',
  [ResidentStatus.ACTIVE]: 'success',
  [ResidentStatus.DISCIPLINE]: 'warning',
  [ResidentStatus.TEMP_LEAVE]: 'info',
  [ResidentStatus.DISCHARGED]: 'purple',
  [ResidentStatus.EVADED]: 'destructive',
};

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

const fetchResidents = () => api.get<Resident[]>('/residents').then((r) => r.data);
const deleteResident = (id: string) => api.delete(`/residents/${id}`);

function Avatar({ url, name }: { url: string | null; name: string }) {
  const src = photoUrl(url);
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

export function ResidentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<Resident | null>(null);

  const { data: residents = [], isLoading, isError } = useQuery({
    queryKey: ['residents'],
    queryFn: fetchResidents,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteResident,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['residents'] });
      setDeleteTarget(null);
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (isError) return <p className="text-destructive">Erro ao carregar filhos.</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Filhos</h1>
        <Button asChild>
          <Link to="/residents/new">
            <Plus size={16} className="mr-2" />
            Novo acolhimento
          </Link>
        </Button>
      </div>

      {residents.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Nenhum acolhido cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {residents.map((resident) => (
            <div
              key={resident.id}
              className="flex w-full items-center gap-4 rounded-lg border bg-card px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/residents/${resident.id}`)}
            >
              <Avatar url={resident.photoUrl} name={resident.name} />
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
                  {computeAge(resident.birthDate) != null && (
                    <span>{computeAge(resident.birthDate)} anos</span>
                  )}
                </div>
              </div>
              <Badge variant={STATUS_VARIANT[resident.status]}>
                {STATUS_LABELS[resident.status]}
              </Badge>
              <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(`/residents/${resident.id}/edit`)}
                  title="Editar"
                >
                  <Pencil size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(resident)}
                  title="Excluir"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
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
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

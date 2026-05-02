import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { ResidentStatus } from '@fonte/types';
import { api } from '@/lib/api';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Resident {
  id: string;
  name: string;
  birthDate: string | null;
  status: ResidentStatus;
  house: { id: string; name: string };
  entryDate: string | null;
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

export function ResidentsPage() {
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Casa</TableHead>
            <TableHead>Entrada</TableHead>
            <TableHead>Idade</TableHead>
            <TableHead className="w-16">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {residents.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Nenhum acolhido cadastrado.
              </TableCell>
            </TableRow>
          )}
          {residents.map((resident) => (
            <TableRow key={resident.id}>
              <TableCell className="font-medium">{resident.name}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[resident.status]}>
                  {STATUS_LABELS[resident.status]}
                </Badge>
              </TableCell>
              <TableCell>{resident.house?.name ?? '—'}</TableCell>
              <TableCell>
                {resident.entryDate ? formatLocalDate(resident.entryDate) : '—'}
              </TableCell>
              <TableCell>{computeAge(resident.birthDate) ?? '—'}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(resident)}
                >
                  <Trash2 size={16} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

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

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Role } from '@fonte/types';
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

interface Staff {
  id: string;
  name: string;
  phone: string | null;
  house: { id: string; name: string } | null;
  user: { email: string; role: Role };
}

const ROLE_LABEL: Record<string, string> = {
  [Role.ADMIN]: 'Administrador',
  [Role.COORDINATOR]: 'Coordenador',
  [Role.OPERATOR]: 'Operador',
};

const ROLE_VARIANT: Record<string, 'destructive' | 'info' | 'secondary'> = {
  [Role.ADMIN]: 'destructive',
  [Role.COORDINATOR]: 'info',
  [Role.OPERATOR]: 'secondary',
};

const fetchStaff = () => api.get<Staff[]>('/staff').then((r) => r.data);
const deleteStaff = (id: string) => api.delete(`/staff/${id}`);

export function StaffPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);

  const { data: staff = [], isLoading, isError } = useQuery({
    queryKey: ['staff'],
    queryFn: fetchStaff,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStaff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setDeleteTarget(null);
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (isError) return <p className="text-destructive">Erro ao carregar servos.</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Servos</h1>
        <Button asChild>
          <Link to="/staff/new">
            <Plus size={16} className="mr-2" />
            Novo Servo
          </Link>
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Função</TableHead>
            <TableHead>Casa</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead className="w-20">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Nenhum servo cadastrado.
              </TableCell>
            </TableRow>
          )}
          {staff.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell>
                <Badge variant={ROLE_VARIANT[s.user.role] ?? 'secondary'}>
                  {ROLE_LABEL[s.user.role] ?? s.user.role}
                </Badge>
              </TableCell>
              <TableCell>{s.house?.name ?? '—'}</TableCell>
              <TableCell className="text-muted-foreground">{s.user.email}</TableCell>
              <TableCell>{s.phone ?? '—'}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate(`/staff/${s.id}/edit`)}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(s)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Servo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? O acesso ao
              sistema será revogado. Esta ação não pode ser desfeita.
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

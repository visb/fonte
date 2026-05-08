import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useGoBack } from '@/lib/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { Role } from '@fonte/types';
import { getErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingState } from '@/components/shared/LoadingState';
import { maskPhone, withMask } from '@/features/residents/lib/masks';
import { useUpdateStaff, useStaffById } from '../hooks/useStaff';
import { useHouses } from '@/features/houses/hooks/useHouses';

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  role: z.enum([Role.ADMIN, Role.COORDINATOR, Role.OPERATOR]),
  houseId: z.string().min(1, 'Casa é obrigatória'),
  phone: z.string().optional().or(z.literal('')),
});
type FormData = z.infer<typeof schema>;

export function EditStaffPage() {
  const { id } = useParams<{ id: string }>();
  const goBack = useGoBack('/staff');

  const { data: houses = [] } = useHouses();
  const { data: staff, isLoading } = useStaffById(id!);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (staff) {
      reset({
        name: staff.name,
        email: staff.user.email,
        role: staff.user.role as FormData['role'],
        houseId: staff.houseId,
        phone: staff.phone ?? '',
      });
    }
  }, [staff, reset]);

  const updateMutation = useUpdateStaff(id!);

  const onSubmit = (data: FormData) => {
    updateMutation.mutate(
      { name: data.name, email: data.email, role: data.role, houseId: data.houseId, phone: data.phone || null },
      { onSuccess: () => goBack() },
    );
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={goBack}>
          <ArrowLeft size={18} />
        </Button>
        <h1 className="text-2xl font-bold">Editar Servo</h1>
      </div>

      {updateMutation.isError && (
        <p className="text-sm text-destructive mb-4">
          {getErrorMessage(updateMutation.error, 'Erro ao salvar alterações.')}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome *</Label>
          <Input id="name" {...register('name')} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail *</Label>
          <Input id="email" type="email" {...register('email')} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Função *</Label>
          <select id="role" {...register('role')} className={SELECT_CLASS}>
            <option value={Role.ADMIN}>Administrador</option>
            <option value={Role.COORDINATOR}>Coordenador</option>
            <option value={Role.OPERATOR}>Operador</option>
          </select>
          {errors.role && <p className="text-sm text-destructive">{errors.role.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="houseId">Casa *</Label>
          <select id="houseId" {...register('houseId')} className={SELECT_CLASS}>
            <option value="">Selecione...</option>
            {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          {errors.houseId && <p className="text-sm text-destructive">{errors.houseId.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" {...withMask(register('phone'), maskPhone)} placeholder="(11) 99999-9999" />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={goBack}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting || updateMutation.isPending}>Salvar</Button>
        </div>
      </form>
    </div>
  );
}

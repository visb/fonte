import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { SupportGroup } from '@fonte/api-client';
import { DAY_OF_WEEK_LABELS } from '@fonte/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCreateSupportGroup, useUpdateSupportGroup } from '../hooks/useSupportGroups';
import { useStaff } from '@/features/staff/hooks/useStaff';

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  churchName: z.string().min(1, 'Nome da igreja é obrigatório'),
  address: z.string().min(1, 'Endereço é obrigatório'),
  coordinatorId: z.preprocess(
    (val) => (val === '' || val === null ? null : val),
    z.string().uuid().nullable().optional(),
  ),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
});
type FormData = z.infer<typeof schema>;

const DAY_OPTIONS = Object.entries(DAY_OF_WEEK_LABELS).map(([value, label]) => ({
  value: Number(value),
  label,
}));

interface Props {
  open: boolean;
  group: SupportGroup | null;
  onClose: () => void;
}

export function SupportGroupDialog({ open, group, onClose }: Props) {
  const { data: staff = [] } = useStaff();
  const createMutation = useCreateSupportGroup();
  const updateMutation = useUpdateSupportGroup();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      if (group) {
        reset({
          name: group.name,
          churchName: group.churchName,
          address: group.address,
          coordinatorId: group.coordinatorId,
          dayOfWeek: group.dayOfWeek,
        });
      } else {
        reset({ name: '', churchName: '', address: '', coordinatorId: null, dayOfWeek: 0 });
      }
    }
  }, [open, group, reset]);

  useEffect(() => {
    if (open && group && staff.length) setValue('coordinatorId', group.coordinatorId ?? null);
  }, [open, group, staff, setValue]);

  const onSubmit = (data: FormData) => {
    const payload = { ...data, coordinatorId: data.coordinatorId || null };
    if (group) {
      updateMutation.mutate({ id: group.id, data: payload }, { onSuccess: onClose });
    } else {
      createMutation.mutate(payload, { onSuccess: onClose });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const selectedDay = watch('dayOfWeek');

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{group ? 'Editar grupo de apoio' : 'Novo grupo de apoio'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="sg-name">Nome *</Label>
              <Input id="sg-name" {...register('name')} placeholder="Ex: Grupo Recomeço..." autoFocus />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="sg-church">Nome da Igreja *</Label>
              <Input id="sg-church" {...register('churchName')} placeholder="Ex: Igreja Batista Central..." />
              {errors.churchName && <p className="text-xs text-destructive">{errors.churchName.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="sg-address">Endereço *</Label>
              <Input id="sg-address" {...register('address')} placeholder="Ex: Rua das Flores, 123..." />
              {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="sg-day">Dia da semana *</Label>
              <select
                id="sg-day"
                className="w-full border border-input rounded-md bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={selectedDay}
                onChange={(e) => setValue('dayOfWeek', Number(e.target.value))}
              >
                {DAY_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="sg-coordinator">Coordenador (opcional)</Label>
              <select
                id="sg-coordinator"
                className="w-full border border-input rounded-md bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                {...register('coordinatorId')}
              >
                <option value="">— Sem coordenador</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting || isPending}>
              {isPending ? 'Salvando...' : group ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

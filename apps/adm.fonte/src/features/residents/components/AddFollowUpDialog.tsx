import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FollowUpAccessLevel, FollowUpType } from '@fonte/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FOLLOW_UP_ACCESS_LABELS, FOLLOW_UP_TYPE_LABELS } from '../constants';
import { useCreateFollowUp } from '../hooks/useResidentFollowUps';

const schema = z.object({
  date: z.string().min(1, 'Data é obrigatória'),
  type: z.nativeEnum(FollowUpType),
  description: z.string().optional(),
  accessLevel: z.nativeEnum(FollowUpAccessLevel),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  residentId: string;
}

export function AddFollowUpDialog({ open, onClose, residentId }: Props) {
  const mutation = useCreateFollowUp(residentId);

  const today = new Date().toISOString().split('T')[0];

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: {
        date: today,
        type: FollowUpType.NOTE,
        accessLevel: FollowUpAccessLevel.ALL,
      },
    });

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar evento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((data) =>
          mutation.mutate(
            { ...data, description: data.description || undefined },
            { onSuccess: handleClose },
          )
        )}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fu-date">Data *</Label>
              <Input id="fu-date" type="date" {...register('date')} />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fu-type">Tipo *</Label>
              <Select id="fu-type" {...register('type')}>
                {Object.values(FollowUpType)
                  .filter((t) => t !== FollowUpType.MONTHLY_CONTRIBUTION)
                  .map((t) => (
                    <option key={t} value={t}>{FOLLOW_UP_TYPE_LABELS[t]}</option>
                  ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fu-description">Descrição</Label>
              <Textarea
                id="fu-description"
                {...register('description')}
                placeholder="Detalhes do evento..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fu-access">Visibilidade *</Label>
              <Select id="fu-access" {...register('accessLevel')}>
                {Object.values(FollowUpAccessLevel).map((a) => (
                  <option key={a} value={a}>{FOLLOW_UP_ACCESS_LABELS[a]}</option>
                ))}
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

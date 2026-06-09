import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { maskPhone, withMask } from '@/lib/masks';
import { RELATIONSHIP_OPTIONS } from '../constants';
import { useAddRelative } from '../hooks/useResidents';

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  relationship: z.string().optional().or(z.literal('')),
  relationshipOther: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  residentId: string;
}

export function AddRelativeDialog({ open, onClose, residentId }: Props) {
  const mutation = useAddRelative(residentId);
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const isOther = watch('relationship') === 'Outro';

  function handleClose() {
    reset();
    onClose();
  }

  function onSubmit(data: FormData) {
    const relationship = data.relationship === 'Outro' ? data.relationshipOther : data.relationship;
    mutation.mutate({ name: data.name, relationship, phone: data.phone }, { onSuccess: handleClose });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar familiar</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rel-name">Nome *</Label>
              <Input id="rel-name" {...register('name')} placeholder="Nome completo" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="rel-relationship">Parentesco</Label>
              <Select id="rel-relationship" {...register('relationship')}>
                <option value="">Selecione...</option>
                {RELATIONSHIP_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
              {isOther && (
                <Input
                  {...register('relationshipOther')}
                  placeholder="Especifique o parentesco"
                  className="mt-2"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="rel-phone">Telefone</Label>
              <Input id="rel-phone" {...withMask(register('phone'), maskPhone)} placeholder="(00) 00000-0000" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>Adicionar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateRule } from '../../hooks/useHouseRules';

const schema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  content: z.string().min(1, 'Conteúdo é obrigatório'),
});
type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  houseId: string;
}

export function AddRuleDialog({ open, onClose, houseId }: Props) {
  const mutation = useCreateRule(houseId);

  const { register, handleSubmit, reset, formState: { errors } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nova Regra</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((data) => mutation.mutate(data, { onSuccess: handleClose }))} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="rule-title">Título *</Label>
            <Input id="rule-title" {...register('title')} placeholder="Ex: Horário de recolher" />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rule-content">Conteúdo *</Label>
            <Textarea id="rule-content" {...register('content')} placeholder="Descreva a regra em detalhe..." rows={4} />
            {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

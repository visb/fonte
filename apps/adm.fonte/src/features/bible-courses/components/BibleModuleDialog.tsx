import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { BibleCourseModule } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/errors';
import { useCreateBibleModule, useUpdateBibleModule } from '../hooks/useBibleModules';
import { bibleModuleSchema, type BibleModuleFormData } from '../lib/bibleModuleSchema';

interface Props {
  open: boolean;
  module: BibleCourseModule | null;
  /** Sequence to suggest for a brand new module (last + 1). */
  nextSequence?: number;
  onClose: () => void;
}

export function BibleModuleDialog({ open, module, nextSequence = 0, onClose }: Props) {
  const createMutation = useCreateBibleModule();
  const updateMutation = useUpdateBibleModule();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<BibleModuleFormData>({ resolver: zodResolver(bibleModuleSchema) });

  useEffect(() => {
    if (!open) return;
    if (module) {
      reset({ name: module.name, sequence: module.sequence, notes: module.notes ?? '' });
    } else {
      reset({ name: '', sequence: nextSequence, notes: '' });
    }
  }, [open, module, nextSequence, reset]);

  const onSubmit = (data: BibleModuleFormData) => {
    const payload = {
      name: data.name,
      sequence: data.sequence,
      notes: data.notes || null,
    };
    if (module) {
      updateMutation.mutate({ id: module.id, data: payload }, { onSuccess: onClose });
    } else {
      createMutation.mutate(payload, { onSuccess: onClose });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error || updateMutation.error;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{module ? 'Editar módulo' : 'Novo módulo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="bm-name">Nome *</Label>
              <Input id="bm-name" {...register('name')} placeholder="Ex: Gênesis" autoFocus />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="bm-sequence">Ordem *</Label>
              <Input id="bm-sequence" type="number" min={0} {...register('sequence')} />
              {errors.sequence && <p className="text-xs text-destructive">{errors.sequence.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="bm-notes">Observações</Label>
              <Input id="bm-notes" {...register('notes')} placeholder="Opcional" />
            </div>

            {mutationError && (
              <p className="text-xs text-destructive">
                {getErrorMessage(mutationError, 'Erro ao salvar módulo.')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting || isPending}>
              {isPending ? 'Salvando...' : module ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

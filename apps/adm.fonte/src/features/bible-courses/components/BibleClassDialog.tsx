import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { BibleCourseClass } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/errors';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { useCreateBibleClass, useUpdateBibleClass } from '../hooks/useBibleCourses';
import { bibleClassSchema, type BibleClassFormData, addDays } from '../lib/bibleCourseSchema';
import { CLASS_DURATION_DAYS } from '../constants';

interface Props {
  open: boolean;
  klass: BibleCourseClass | null;
  /** End date of the most recent class — a new class opens right after it. */
  defaultStartDate?: string;
  onClose: () => void;
}

export function BibleClassDialog({ open, klass, defaultStartDate, onClose }: Props) {
  const { data: houses = [] } = useHouses();
  const motherHouse = houses.find((h) => h.isMotherHouse);
  const createMutation = useCreateBibleClass();
  const updateMutation = useUpdateBibleClass();

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } =
    useForm<BibleClassFormData>({ resolver: zodResolver(bibleClassSchema) });

  useEffect(() => {
    if (!open) return;
    if (klass) {
      reset({
        name: klass.name,
        houseId: klass.houseId,
        startDate: klass.startDate,
        endDate: klass.endDate,
        notes: '',
      });
    } else {
      const start = defaultStartDate ?? new Date().toISOString().slice(0, 10);
      reset({
        name: '',
        houseId: motherHouse?.id ?? '',
        startDate: start,
        endDate: addDays(start, CLASS_DURATION_DAYS),
        notes: '',
      });
    }
  }, [open, klass, defaultStartDate, motherHouse?.id, reset]);

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const start = e.target.value;
    setValue('startDate', start);
    if (start) setValue('endDate', addDays(start, CLASS_DURATION_DAYS));
  };

  const onSubmit = (data: BibleClassFormData) => {
    const payload = {
      name: data.name,
      houseId: data.houseId,
      startDate: data.startDate,
      endDate: data.endDate,
      notes: data.notes || null,
    };
    if (klass) {
      updateMutation.mutate({ id: klass.id, data: payload }, { onSuccess: onClose });
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
          <DialogTitle>{klass ? 'Editar turma' : 'Nova turma'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="bc-name">Nome *</Label>
              <Input id="bc-name" {...register('name')} placeholder="Ex: Turma 2026/1" autoFocus />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="bc-house">Casa *</Label>
              <select
                id="bc-house"
                className="w-full border border-input rounded-md bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                {...register('houseId')}
              >
                <option value="">— Selecione a casa</option>
                {houses.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}{h.isMotherHouse ? ' (casa mãe)' : ''}
                  </option>
                ))}
              </select>
              {errors.houseId && <p className="text-xs text-destructive">{errors.houseId.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="bc-start">Início *</Label>
                <Input id="bc-start" type="date" {...register('startDate')} onChange={handleStartChange} />
                {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="bc-end">Término *</Label>
                <Input id="bc-end" type="date" {...register('endDate')} />
                {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="bc-notes">Observações</Label>
              <Input id="bc-notes" {...register('notes')} placeholder="Opcional" />
            </div>

            {mutationError && (
              <p className="text-xs text-destructive">
                {getErrorMessage(mutationError, 'Erro ao salvar turma.')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting || isPending}>
              {isPending ? 'Salvando...' : klass ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

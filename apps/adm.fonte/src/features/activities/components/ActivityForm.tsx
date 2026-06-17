import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Activity } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DialogFooter } from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/errors';
import { useHouses } from '@/features/houses/hooks/useHouses';
import { activitySchema, type ActivityFormData } from '../lib/activitySchema';

interface Props {
  activity?: Activity | null;
  isPending: boolean;
  error: unknown;
  onSubmit: (data: ActivityFormData) => void;
  onCancel: () => void;
}

export function ActivityForm({ activity, isPending, error, onSubmit, onCancel }: Props) {
  const { data: houses = [] } = useHouses();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ActivityFormData>({ resolver: zodResolver(activitySchema) });

  useEffect(() => {
    if (activity) {
      reset({
        title: activity.title,
        description: activity.description ?? '',
        houseId: activity.houseId ?? '',
      });
    } else {
      reset({ title: '', description: '', houseId: '' });
    }
  }, [activity, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-4 py-4">
        <div className="space-y-1">
          <Label htmlFor="activity-title">Título *</Label>
          <Input
            id="activity-title"
            {...register('title')}
            placeholder="Ex: Consertar o portão"
            autoFocus
          />
          {errors.title && (
            <p className="text-xs text-destructive">{errors.title.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="activity-description">Descrição</Label>
          <Textarea
            id="activity-description"
            {...register('description')}
            placeholder="Opcional"
            rows={3}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="activity-house">Casa</Label>
          <Select id="activity-house" defaultValue="" {...register('houseId')}>
            <option value="">Geral (sem casa)</option>
            {houses.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
        </div>

        {error != null && (
          <p className="text-xs text-destructive">
            {getErrorMessage(error, 'Erro ao salvar atividade.')}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || isPending}>
          {isPending ? 'Salvando...' : activity ? 'Salvar' : 'Criar'}
        </Button>
      </DialogFooter>
    </form>
  );
}

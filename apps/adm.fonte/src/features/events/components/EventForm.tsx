import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Event } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DialogFooter } from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/errors';
import { eventSchema, type EventFormData } from '../lib/eventSchema';
import { isoToLocalInput } from '../lib/eventDates';

interface Props {
  event?: Event | null;
  isPending: boolean;
  error: unknown;
  onSubmit: (data: EventFormData) => void;
  onCancel: () => void;
}

const emptyForm: EventFormData = {
  title: '',
  description: '',
  startAt: '',
  endAt: '',
  location: '',
  capacity: undefined,
  registrationOpensAt: '',
  registrationClosesAt: '',
};

function eventToForm(event?: Event | null): EventFormData {
  if (!event) return emptyForm;
  return {
    title: event.title,
    description: event.description,
    startAt: isoToLocalInput(event.startAt),
    endAt: event.endAt ? isoToLocalInput(event.endAt) : '',
    location: event.location ?? '',
    capacity: event.capacity ?? undefined,
    registrationOpensAt: event.registrationOpensAt
      ? isoToLocalInput(event.registrationOpensAt)
      : '',
    registrationClosesAt: event.registrationClosesAt
      ? isoToLocalInput(event.registrationClosesAt)
      : '',
  };
}

export function EventForm({ event, isPending, error, onSubmit, onCancel }: Props) {
  // defaultValues calculados na montagem; o formulário é remontado a cada
  // abertura do dialog (ou troca de evento via key), evitando reset pós-montagem.
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: eventToForm(event),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-4 py-4">
        <div className="space-y-1">
          <Label htmlFor="event-title">Título *</Label>
          <Input id="event-title" {...register('title')} placeholder="Ex: Retiro de famílias" autoFocus />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="event-description">Descrição *</Label>
          <Textarea id="event-description" {...register('description')} rows={3} />
          {errors.description && (
            <p className="text-xs text-destructive">{errors.description.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="event-start">Início *</Label>
            <Input id="event-start" type="datetime-local" {...register('startAt')} />
            {errors.startAt && <p className="text-xs text-destructive">{errors.startAt.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="event-end">Fim</Label>
            <Input id="event-end" type="datetime-local" {...register('endAt')} />
            {errors.endAt && <p className="text-xs text-destructive">{errors.endAt.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="event-location">Local</Label>
            <Input id="event-location" {...register('location')} placeholder="Opcional" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="event-capacity">Vagas</Label>
            <Input
              id="event-capacity"
              type="number"
              min={1}
              {...register('capacity')}
              placeholder="Ilimitado"
            />
            {errors.capacity && (
              <p className="text-xs text-destructive">{errors.capacity.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="event-reg-opens">Inscrições abrem</Label>
            <Input id="event-reg-opens" type="datetime-local" {...register('registrationOpensAt')} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="event-reg-closes">Inscrições fecham</Label>
            <Input
              id="event-reg-closes"
              type="datetime-local"
              {...register('registrationClosesAt')}
            />
            {errors.registrationClosesAt && (
              <p className="text-xs text-destructive">{errors.registrationClosesAt.message}</p>
            )}
          </div>
        </div>

        {error != null && (
          <p className="text-xs text-destructive">{getErrorMessage(error, 'Erro ao salvar evento.')}</p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || isPending}>
          {isPending ? 'Salvando...' : event ? 'Salvar' : 'Criar'}
        </Button>
      </DialogFooter>
    </form>
  );
}

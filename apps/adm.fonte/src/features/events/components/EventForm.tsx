import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Event } from '@fonte/api-client';
import { EventAudience } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DialogFooter } from '@/components/ui/dialog';
import { getErrorMessage } from '@/lib/errors';
import { eventSchema, fieldsToForm, type EventFormData } from '../lib/eventSchema';
import { isoToLocalInput } from '../lib/eventDates';
import { EventRegistrationSection } from './EventRegistrationSection';

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
  audience: EventAudience.PUBLIC,
  capacity: undefined,
  registrationEnabled: false,
  paymentEnabled: false,
  priceReais: undefined,
  registrationFields: [],
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
    audience: event.audience,
    capacity: event.capacity ?? undefined,
    registrationEnabled: event.registrationEnabled,
    paymentEnabled: event.paymentEnabled,
    priceReais: event.priceCents != null ? event.priceCents / 100 : undefined,
    registrationFields: fieldsToForm(event.registrationFields),
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
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: eventToForm(event),
  });

  const registrationEnabled = watch('registrationEnabled');
  const paymentEnabled = watch('paymentEnabled');
  const audience = watch('audience');
  const isInternal = audience === EventAudience.INTERNAL;

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

        <div className="space-y-1">
          <Label htmlFor="event-location">Local</Label>
          <Input id="event-location" {...register('location')} placeholder="Opcional" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="event-audience">Tipo de evento</Label>
          <select
            id="event-audience"
            data-testid="event-audience"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            {...register('audience')}
          >
            <option value={EventAudience.PUBLIC}>Público (famílias e comunidade)</option>
            <option value={EventAudience.INTERNAL}>Interno (apenas servos)</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Eventos internos são só divulgação para os servos: não aparecem no portal
            público nem aceitam inscrição.
          </p>
        </div>

        {!isInternal && (
          <EventRegistrationSection
            register={register}
            errors={errors}
            control={control}
            enabled={registrationEnabled}
            paymentEnabled={paymentEnabled}
          />
        )}

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

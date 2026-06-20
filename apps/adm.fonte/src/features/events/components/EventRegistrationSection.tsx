import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { EventFormData } from '../lib/eventSchema';

interface Props {
  register: UseFormRegister<EventFormData>;
  errors: FieldErrors<EventFormData>;
  /** Estado atual do toggle (via watch); habilita os demais campos. */
  enabled: boolean;
}

/**
 * Seção de inscrição do formulário de evento (story 67). O toggle
 * `registrationEnabled` controla se o evento aceita inscrição; quando off,
 * vagas e janela ficam desabilitados (evento só-divulgação).
 */
export function EventRegistrationSection({ register, errors, enabled }: Props) {
  return (
    <fieldset className="space-y-3 rounded-md border p-3">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="h-4 w-4"
          data-testid="registration-enabled"
          {...register('registrationEnabled')}
        />
        <span className="text-sm font-medium">Aceitar inscrições neste evento</span>
      </label>
      <p className="text-xs text-muted-foreground">
        Eventos sem inscrição não aparecem no portal público (só-divulgação).
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="event-capacity">Vagas</Label>
          <Input
            id="event-capacity"
            type="number"
            min={1}
            disabled={!enabled}
            {...register('capacity')}
            placeholder="Ilimitado"
          />
          {errors.capacity && (
            <p className="text-xs text-destructive">{errors.capacity.message}</p>
          )}
        </div>
        <div />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="event-reg-opens">Inscrições abrem</Label>
          <Input
            id="event-reg-opens"
            type="datetime-local"
            disabled={!enabled}
            {...register('registrationOpensAt')}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="event-reg-closes">Inscrições fecham</Label>
          <Input
            id="event-reg-closes"
            type="datetime-local"
            disabled={!enabled}
            {...register('registrationClosesAt')}
          />
          {errors.registrationClosesAt && (
            <p className="text-xs text-destructive">{errors.registrationClosesAt.message}</p>
          )}
        </div>
      </div>
    </fieldset>
  );
}

import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { EventFormData } from '../lib/eventSchema';
import { RegistrationFieldsBuilder } from './RegistrationFieldsBuilder';

interface Props {
  register: UseFormRegister<EventFormData>;
  errors: FieldErrors<EventFormData>;
  control: Control<EventFormData>;
  /** Estado atual do toggle (via watch); habilita os demais campos. */
  enabled: boolean;
  /** Estado do toggle de cobrança (story 69); habilita o campo de valor. */
  paymentEnabled: boolean;
}

/**
 * Seção de inscrição do formulário de evento (story 67). O toggle
 * `registrationEnabled` controla se o evento aceita inscrição; quando off,
 * vagas e janela ficam desabilitados (evento só-divulgação).
 */
export function EventRegistrationSection({
  register,
  errors,
  control,
  enabled,
  paymentEnabled,
}: Props) {
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

      {/* Cobrança da inscrição (story 69). */}
      <div className="space-y-2 rounded-md border border-dashed p-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4"
            data-testid="payment-enabled"
            disabled={!enabled}
            {...register('paymentEnabled')}
          />
          <span className="text-sm font-medium">Inscrição paga</span>
        </label>
        <div className="space-y-1">
          <Label htmlFor="event-price">Valor da inscrição (R$)</Label>
          <Input
            id="event-price"
            type="number"
            min={0}
            step="0.01"
            data-testid="event-price"
            disabled={!enabled || !paymentEnabled}
            {...register('priceReais')}
            placeholder="Ex: 50,00"
          />
          {errors.priceReais && (
            <p className="text-xs text-destructive">{errors.priceReais.message}</p>
          )}
        </div>
      </div>

      {enabled && (
        <RegistrationFieldsBuilder register={register} control={control} errors={errors} />
      )}
    </fieldset>
  );
}

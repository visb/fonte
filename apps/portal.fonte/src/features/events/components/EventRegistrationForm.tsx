import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { EventPublic, RegisterToEventInput, RegistrationAnswerValue } from '@fonte/types';
import { getErrorMessage } from '@/lib/errors';
import { buildRegistrationSchema, buildDefaultValues } from '../lib/registrationSchema';
import { DynamicField, type RegistrationFormValues } from './DynamicField';

interface Props {
  event: EventPublic;
  submitting: boolean;
  error: unknown;
  onSubmit: (data: RegisterToEventInput) => void;
}

/** Remove respostas vazias antes de enviar (campos opcionais não preenchidos). */
function cleanAnswers(
  answers: Record<string, unknown>,
): Record<string, RegistrationAnswerValue> {
  const out: Record<string, RegistrationAnswerValue> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value as RegistrationAnswerValue;
  }
  return out;
}

export function EventRegistrationForm({ event, submitting, error, onSubmit }: Props) {
  const fields = event.registrationFields ?? [];
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegistrationFormValues>({
    resolver: zodResolver(buildRegistrationSchema(fields)),
    defaultValues: buildDefaultValues(fields),
  });

  // Inscrição fechada: mostra o motivo, sem formulário.
  if (!event.registrationOpen) {
    const soldOut = event.spotsLeft != null && event.spotsLeft <= 0;
    return (
      <div className="card center">
        <div className="emoji">{soldOut ? '🚫' : '⏰'}</div>
        <h2>{soldOut ? 'Vagas esgotadas' : 'Inscrições encerradas'}</h2>
        <p>
          {soldOut
            ? 'Todas as vagas deste evento já foram preenchidas.'
            : 'As inscrições para este evento não estão abertas no momento.'}
        </p>
      </div>
    );
  }

  const submit = handleSubmit((values) => {
    onSubmit({
      name: values.name,
      contact: values.contact,
      email: values.email ? values.email : null,
      answers: cleanAnswers(values.answers),
    });
  });

  return (
    <form onSubmit={submit} noValidate>
      <h2>Inscreva-se</h2>
      {event.spotsLeft != null && (
        <p className="hint">{event.spotsLeft} vaga(s) restante(s)</p>
      )}

      <div className="field">
        <label htmlFor="reg-name">Nome</label>
        <input id="reg-name" autoComplete="name" {...register('name')} />
        {errors.name && <p className="error-msg">{errors.name.message}</p>}
      </div>

      <div className="field">
        <label htmlFor="reg-contact">Telefone / WhatsApp</label>
        <input
          id="reg-contact"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(11) 99999-0000"
          {...register('contact')}
        />
        {errors.contact && <p className="error-msg">{errors.contact.message}</p>}
      </div>

      <div className="field">
        <label htmlFor="reg-email">E-mail (opcional)</label>
        <input id="reg-email" inputMode="email" autoComplete="email" {...register('email')} />
        {errors.email && <p className="error-msg">{errors.email.message}</p>}
      </div>

      {fields.map((field) => (
        <DynamicField
          key={field.id}
          field={field}
          eventId={event.id}
          control={control}
          errors={errors}
        />
      ))}

      {error != null && (
        <p className="error-msg">{getErrorMessage(error, 'Não foi possível concluir a inscrição.')}</p>
      )}

      <button className="primary" type="submit" disabled={submitting}>
        {submitting ? 'Enviando...' : 'Confirmar inscrição'}
      </button>
    </form>
  );
}

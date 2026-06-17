import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { EventPublic, RegisterToEventInput } from '@fonte/types';
import { getErrorMessage } from '@/lib/errors';

const schema = z.object({
  name: z.string().min(1, 'Informe seu nome'),
  contact: z.string().min(5, 'Informe um telefone/WhatsApp ou e-mail de contato'),
  email: z
    .string()
    .email('E-mail inválido')
    .optional()
    .or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  event: EventPublic;
  submitting: boolean;
  error: unknown;
  onSubmit: (data: RegisterToEventInput) => void;
}

export function EventRegistrationForm({ event, submitting, error, onSubmit }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', contact: '', email: '' },
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

      {error != null && (
        <p className="error-msg">{getErrorMessage(error, 'Não foi possível concluir a inscrição.')}</p>
      )}

      <button className="primary" type="submit" disabled={submitting}>
        {submitting ? 'Enviando...' : 'Confirmar inscrição'}
      </button>
    </form>
  );
}

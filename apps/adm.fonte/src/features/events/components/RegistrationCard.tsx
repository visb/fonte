import type {
  EventRegistration,
  RegistrationField,
  RegistrationAnswerValue,
} from '@fonte/api-client';
import { EventPaymentStatus } from '@fonte/api-client';
import {
  EVENT_PAYMENT_STATUS_BADGE,
  EVENT_PAYMENT_STATUS_LABELS,
} from '../constants';

interface Props {
  registration: EventRegistration;
  fields: RegistrationField[];
}

/** Formata centavos como moeda pt-BR (story 69). */
function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Formata um valor de resposta para exibição (story 68). */
function formatValue(value: RegistrationAnswerValue): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return String(value);
}

/**
 * Card de uma inscrição com a base fixa (nome/contato/e-mail) e as respostas
 * dos campos custom. Campos `file` viram link (URL já assinada pelo backend).
 */
export function RegistrationCard({ registration, fields }: Props) {
  return (
    <div className="rounded-md border p-3 text-sm" data-testid="registration-card">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{registration.name}</p>
        {registration.paymentStatus !== EventPaymentStatus.NONE && (
          <span
            data-testid="registration-payment-status"
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              EVENT_PAYMENT_STATUS_BADGE[registration.paymentStatus]
            }`}
          >
            {EVENT_PAYMENT_STATUS_LABELS[registration.paymentStatus]}
            {registration.amountCents != null && registration.paymentStatus !== undefined
              ? ` · ${formatCents(registration.amountCents)}`
              : ''}
          </span>
        )}
      </div>
      <p className="text-muted-foreground">{registration.contact}</p>
      {registration.email && <p className="text-muted-foreground">{registration.email}</p>}

      {fields.length > 0 && (
        <dl className="mt-2 space-y-1">
          {fields.map((field) => {
            const value = registration.answers?.[field.id];
            if (value === undefined || value === null || value === '') return null;
            return (
              <div key={field.id} className="flex gap-2">
                <dt className="font-medium text-muted-foreground">{field.label}:</dt>
                <dd>
                  {field.type === 'file' && typeof value === 'string' ? (
                    <a
                      href={value}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline"
                    >
                      Ver arquivo
                    </a>
                  ) : (
                    formatValue(value)
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}

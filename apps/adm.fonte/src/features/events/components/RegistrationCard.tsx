import type {
  EventRegistration,
  RegistrationField,
  RegistrationAnswerValue,
} from '@fonte/api-client';

interface Props {
  registration: EventRegistration;
  fields: RegistrationField[];
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
      <p className="font-medium">{registration.name}</p>
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

import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import type { RegistrationField } from '@fonte/types';
import { RegistrationFileField } from './RegistrationFileField';

interface Props {
  field: RegistrationField;
  eventId: string;
  control: Control<RegistrationFormValues>;
  errors: FieldErrors<RegistrationFormValues>;
}

// Tipagem solta o suficiente para o form dinâmico (answers é um mapa aberto).
export interface RegistrationFormValues {
  name: string;
  contact: string;
  email?: string;
  answers: Record<string, unknown>;
}

/**
 * Renderiza um campo do formulário de inscrição despachando por `type`
 * (story 68). Cada campo grava em `answers[field.id]`.
 */
export function DynamicField({ field, eventId, control, errors }: Props) {
  const name = `answers.${field.id}` as const;
  const error = (errors.answers as Record<string, { message?: string }> | undefined)?.[field.id];
  const label = (
    <label htmlFor={`rf-${field.id}`}>
      {field.label}
      {field.required && ' *'}
    </label>
  );

  return (
    <div className="field" data-testid={`dyn-field-${field.id}`}>
      {field.type !== 'boolean' && label}

      <Controller
        control={control}
        name={name}
        render={({ field: rhf }) => {
          switch (field.type) {
            case 'long_text':
              return (
                <textarea id={`rf-${field.id}`} rows={3} {...rhf} value={(rhf.value as string) ?? ''} />
              );
            case 'number':
              return (
                <input
                  id={`rf-${field.id}`}
                  type="number"
                  inputMode="numeric"
                  {...rhf}
                  value={(rhf.value as string | number) ?? ''}
                />
              );
            case 'date':
              return (
                <input id={`rf-${field.id}`} type="date" {...rhf} value={(rhf.value as string) ?? ''} />
              );
            case 'email':
              return (
                <input id={`rf-${field.id}`} type="email" {...rhf} value={(rhf.value as string) ?? ''} />
              );
            case 'phone':
              return (
                <input id={`rf-${field.id}`} inputMode="tel" {...rhf} value={(rhf.value as string) ?? ''} />
              );
            case 'boolean':
              return (
                <label className="checkbox-label">
                  <input
                    id={`rf-${field.id}`}
                    type="checkbox"
                    checked={!!rhf.value}
                    onChange={(e) => rhf.onChange(e.target.checked)}
                    onBlur={rhf.onBlur}
                  />
                  {field.label}
                  {field.required && ' *'}
                </label>
              );
            case 'select':
              return (
                <select id={`rf-${field.id}`} {...rhf} value={(rhf.value as string) ?? ''}>
                  <option value="">Selecione...</option>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              );
            case 'multi_select': {
              const selected = (rhf.value as string[]) ?? [];
              return (
                <div className="multi-select">
                  {(field.options ?? []).map((opt) => (
                    <label key={opt} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selected.includes(opt)}
                        onChange={(e) =>
                          rhf.onChange(
                            e.target.checked
                              ? [...selected, opt]
                              : selected.filter((v) => v !== opt),
                          )
                        }
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              );
            }
            case 'file':
              return (
                <RegistrationFileField
                  eventId={eventId}
                  value={(rhf.value as string) ?? ''}
                  onChange={rhf.onChange}
                />
              );
            case 'short_text':
            default:
              return (
                <input
                  id={`rf-${field.id}`}
                  placeholder={field.placeholder}
                  {...rhf}
                  value={(rhf.value as string) ?? ''}
                />
              );
          }
        }}
      />

      {error?.message && <p className="error-msg">{error.message}</p>}
    </div>
  );
}

import { z } from 'zod';
import { REGISTRATION_FIELD_TYPES } from '@fonte/api-client';

/** Tipos que exigem ao menos uma opção. */
const OPTION_TYPES = ['select', 'multi_select'] as const;

/**
 * Schema de um campo custom do formulário de inscrição (story 68). As opções
 * são editadas no builder como uma única string (uma por linha) e convertidas
 * para array em `toEventInput`.
 */
export const registrationFieldSchema = z
  .object({
    id: z.string().optional(),
    label: z.string().min(1, 'O rótulo é obrigatório'),
    type: z.enum(
      REGISTRATION_FIELD_TYPES as unknown as [string, ...string[]],
    ),
    required: z.boolean().default(false),
    /** Texto livre: uma opção por linha. Só usado por select/multi_select. */
    optionsText: z.string().optional().or(z.literal('')),
  })
  .refine(
    (f) =>
      !(OPTION_TYPES as readonly string[]).includes(f.type) ||
      (f.optionsText ?? '')
        .split('\n')
        .map((o) => o.trim())
        .filter(Boolean).length > 0,
    {
      message: 'Adicione ao menos uma opção',
      path: ['optionsText'],
    },
  );

export type RegistrationFieldFormData = z.infer<typeof registrationFieldSchema>;

export const eventSchema = z
  .object({
    title: z.string().min(1, 'O título é obrigatório'),
    description: z.string().min(1, 'A descrição é obrigatória'),
    /** datetime-local (ex.: 2026-08-01T18:00). */
    startAt: z.string().min(1, 'A data de início é obrigatória'),
    endAt: z.string().optional().or(z.literal('')),
    location: z.string().optional().or(z.literal('')),
    /** '' = vagas ilimitadas. */
    capacity: z.preprocess(
      (v) => (v === '' || v == null ? undefined : v),
      z.coerce
        .number({ invalid_type_error: 'Informe um número' })
        .int('Vagas deve ser um número inteiro')
        .positive('Vagas deve ser maior que zero')
        .optional(),
    ),
    /** Inscrição habilitada (story 67). Default false: evento só-divulgação. */
    registrationEnabled: z.boolean().default(false),
    /** Cobrança da inscrição (story 69). Default false: inscrição grátis. */
    paymentEnabled: z.boolean().default(false),
    /** Preço da inscrição em reais (story 69). '' quando grátis. */
    priceReais: z.preprocess(
      (v) => (v === '' || v == null ? undefined : v),
      z.coerce
        .number({ invalid_type_error: 'Informe um valor' })
        .positive('O valor deve ser maior que zero')
        .optional(),
    ),
    /** Campos custom do formulário de inscrição (story 68). */
    registrationFields: z.array(registrationFieldSchema).default([]),
    registrationOpensAt: z.string().optional().or(z.literal('')),
    registrationClosesAt: z.string().optional().or(z.literal('')),
  })
  .refine(
    (data) => !data.endAt || new Date(data.endAt) >= new Date(data.startAt),
    {
      message: 'O fim deve ser igual ou posterior ao início',
      path: ['endAt'],
    },
  )
  .refine(
    (data) =>
      // Só valida a janela quando a inscrição está habilitada (story 67).
      !data.registrationEnabled ||
      !data.registrationOpensAt ||
      !data.registrationClosesAt ||
      new Date(data.registrationClosesAt) >= new Date(data.registrationOpensAt),
    {
      message: 'O fechamento das inscrições deve ser posterior à abertura',
      path: ['registrationClosesAt'],
    },
  )
  .refine(
    (data) =>
      // Inscrição paga exige valor > 0 (story 69); só quando a inscrição está ligada.
      !data.registrationEnabled ||
      !data.paymentEnabled ||
      (data.priceReais != null && data.priceReais > 0),
    {
      message: 'Informe um valor maior que zero para a inscrição paga',
      path: ['priceReais'],
    },
  );

export type EventFormData = z.infer<typeof eventSchema>;

import type {
  CreateEventInput,
  RegistrationField,
  RegistrationFieldType,
} from '@fonte/api-client';
import { localInputToIso } from './eventDates';

const FIELD_OPTION_TYPES: RegistrationFieldType[] = ['select', 'multi_select'];

/** optionsText (uma por linha) → array de opções não-vazias. */
function parseOptions(optionsText?: string): string[] {
  return (optionsText ?? '')
    .split('\n')
    .map((o) => o.trim())
    .filter(Boolean);
}

/** Converte os campos do builder para o contrato da API (story 68). */
export function toRegistrationFields(
  fields: RegistrationFieldFormData[] | undefined,
): RegistrationField[] {
  return (fields ?? []).map((f, index) => {
    const type = f.type as RegistrationFieldType;
    const field: RegistrationField = {
      id: f.id && f.id.trim() ? f.id : undefined as unknown as string,
      label: f.label,
      type,
      required: f.required,
      order: index,
    };
    // id ausente → o backend gera; remove a chave para não enviar undefined.
    if (!field.id) delete (field as { id?: string }).id;
    if (FIELD_OPTION_TYPES.includes(type)) {
      field.options = parseOptions(f.optionsText);
    }
    return field;
  });
}

/** Converte os campos da API para o formato do builder (edição). */
export function fieldsToForm(
  fields: RegistrationField[] | undefined,
): RegistrationFieldFormData[] {
  return (fields ?? []).map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    required: f.required,
    optionsText: (f.options ?? []).join('\n'),
  }));
}

/**
 * Converte os dados do formulário para o input da API (datas → ISO, vazios → null).
 * Story 67: com inscrição desligada, capacidade e janela vão como null (ignoradas).
 * Story 68: campos custom só são enviados quando a inscrição está ligada.
 */
export function toEventInput(data: EventFormData): CreateEventInput {
  const enabled = data.registrationEnabled;
  // Cobrança só vale com inscrição ligada (story 69); preço em reais → centavos.
  const paymentEnabled = enabled && data.paymentEnabled;
  const priceCents =
    paymentEnabled && data.priceReais != null
      ? Math.round(data.priceReais * 100)
      : null;
  return {
    title: data.title,
    description: data.description,
    startAt: localInputToIso(data.startAt)!,
    endAt: localInputToIso(data.endAt),
    location: data.location ? data.location : null,
    registrationEnabled: enabled,
    paymentEnabled,
    priceCents,
    capacity: enabled ? (data.capacity ?? null) : null,
    registrationFields: enabled ? toRegistrationFields(data.registrationFields) : [],
    registrationOpensAt: enabled ? localInputToIso(data.registrationOpensAt) : null,
    registrationClosesAt: enabled ? localInputToIso(data.registrationClosesAt) : null,
  };
}

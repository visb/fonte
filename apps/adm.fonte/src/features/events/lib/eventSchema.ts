import { z } from 'zod';

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
  );

export type EventFormData = z.infer<typeof eventSchema>;

import type { CreateEventInput } from '@fonte/api-client';
import { localInputToIso } from './eventDates';

/**
 * Converte os dados do formulário para o input da API (datas → ISO, vazios → null).
 * Story 67: com inscrição desligada, capacidade e janela vão como null (ignoradas).
 */
export function toEventInput(data: EventFormData): CreateEventInput {
  const enabled = data.registrationEnabled;
  return {
    title: data.title,
    description: data.description,
    startAt: localInputToIso(data.startAt)!,
    endAt: localInputToIso(data.endAt),
    location: data.location ? data.location : null,
    registrationEnabled: enabled,
    capacity: enabled ? (data.capacity ?? null) : null,
    registrationOpensAt: enabled ? localInputToIso(data.registrationOpensAt) : null,
    registrationClosesAt: enabled ? localInputToIso(data.registrationClosesAt) : null,
  };
}

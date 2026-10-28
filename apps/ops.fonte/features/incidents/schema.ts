import { z } from 'zod';
import { IncidentSeverity, todayInSaoPaulo } from '@fonte/types';
import { pastOrTodayDateSchema } from '@/lib/date';

/**
 * Form da nova ocorrência. A data é obrigatória, ISO válida e nunca futura
 * (story 226): ocorrência registra o que já aconteceu. Digitação não passa pelo
 * limite do calendário, então o schema também barra futuro.
 */
export const incidentFormSchema = z.object({
  date: pastOrTodayDateSchema,
  severity: z.nativeEnum(IncidentSeverity),
  description: z.string().min(1, 'Descreva a ocorrência'),
  // Story 227: N filhos envolvidos (vazio = ocorrência da casa).
  residentIds: z.array(z.string()),
});

export type IncidentFormData = z.infer<typeof incidentFormSchema>;

/** Default do form: hoje no fuso local da casa (não o dia UTC de `toISOString()`). */
export function incidentFormDefaults(): IncidentFormData {
  return {
    date: todayInSaoPaulo(),
    severity: IncidentSeverity.MEDIUM,
    description: '',
    residentIds: [],
  };
}

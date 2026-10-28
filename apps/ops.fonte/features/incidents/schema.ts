import { z } from 'zod';
import { IncidentType, todayInSaoPaulo } from '@fonte/types';
import { pastOrTodayDateSchema } from '@/lib/date';

export const INCIDENT_TYPE_REQUIRED_MESSAGE = 'Escolha positiva ou negativa';

/**
 * Form da nova ocorrência. A data é obrigatória, ISO válida e nunca futura
 * (story 226): ocorrência registra o que já aconteceu. Digitação não passa pelo
 * limite do calendário, então o schema também barra futuro.
 */
export const incidentFormSchema = z.object({
  date: pastOrTodayDateSchema,
  // Story 229: tipo obrigatório e sem default — o operador escolhe conscientemente.
  type: z.nativeEnum(IncidentType, {
    errorMap: () => ({ message: INCIDENT_TYPE_REQUIRED_MESSAGE }),
  }),
  description: z.string().min(1, 'Descreva a ocorrência'),
  // Story 227: N filhos envolvidos (vazio = ocorrência da casa).
  residentIds: z.array(z.string()),
});

export type IncidentFormData = z.infer<typeof incidentFormSchema>;

/** Valores iniciais: o tipo começa vazio (sem default, story 229). */
export type IncidentFormDefaults = Omit<IncidentFormData, 'type'> & { type?: IncidentType };

/** Default do form: hoje no fuso local da casa (não o dia UTC de `toISOString()`). */
export function incidentFormDefaults(): IncidentFormDefaults {
  return {
    date: todayInSaoPaulo(),
    type: undefined,
    description: '',
    residentIds: [],
  };
}

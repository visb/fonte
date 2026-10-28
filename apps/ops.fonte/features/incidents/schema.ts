import { z } from 'zod';
import {
  INCIDENT_CATEGORIES_BY_TYPE,
  IncidentCategory,
  IncidentType,
  todayInSaoPaulo,
} from '@fonte/types';
import { pastOrTodayDateSchema } from '@/lib/date';

export const INCIDENT_TYPE_REQUIRED_MESSAGE = 'Escolha positiva ou negativa';
export const INCIDENT_CATEGORY_REQUIRED_MESSAGE = 'Escolha a categoria';
export const INCIDENT_CATEGORY_MISMATCH_MESSAGE = 'Categoria não combina com o tipo';

/**
 * Form da nova ocorrência. A data é obrigatória, ISO válida e nunca futura
 * (story 226): ocorrência registra o que já aconteceu. Digitação não passa pelo
 * limite do calendário, então o schema também barra futuro.
 */
export const incidentFormSchema = z
  .object({
    date: pastOrTodayDateSchema,
    // Story 229: tipo obrigatório e sem default — o operador escolhe conscientemente.
    type: z.nativeEnum(IncidentType, {
      errorMap: () => ({ message: INCIDENT_TYPE_REQUIRED_MESSAGE }),
    }),
    // Story 230: categoria obrigatória, da lista do tipo.
    category: z.nativeEnum(IncidentCategory, {
      errorMap: () => ({ message: INCIDENT_CATEGORY_REQUIRED_MESSAGE }),
    }),
    description: z.string().min(1, 'Descreva a ocorrência'),
    // Story 227: N filhos envolvidos (vazio = ocorrência da casa).
    residentIds: z.array(z.string()),
  })
  .superRefine((data, ctx) => {
    if (!INCIDENT_CATEGORIES_BY_TYPE[data.type].includes(data.category)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['category'],
        message: INCIDENT_CATEGORY_MISMATCH_MESSAGE,
      });
    }
  });

export type IncidentFormData = z.infer<typeof incidentFormSchema>;

/** Valores iniciais: tipo e categoria começam vazios (sem default, stories 229/230). */
export type IncidentFormDefaults = Omit<IncidentFormData, 'type' | 'category'> & {
  type?: IncidentType;
  category?: IncidentCategory;
};

/** Default do form: hoje no fuso local da casa (não o dia UTC de `toISOString()`). */
export function incidentFormDefaults(): IncidentFormDefaults {
  return {
    date: todayInSaoPaulo(),
    type: undefined,
    category: undefined,
    description: '',
    residentIds: [],
  };
}

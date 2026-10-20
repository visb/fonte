import { z } from 'zod';
import { ADMISSION_DATE_MESSAGES, isDateBefore, isFutureDate, todayInSaoPaulo } from '@fonte/types';
import { ADD_RESIDENT_DATE_MESSAGES } from './addResidentSchema';

/**
 * Confirmação do reacolhimento pela contagem (story 218). Mesmas regras de data
 * da readmissão no backend (story 203): entrada não futura e não anterior à
 * última saída — validadas aqui para o lançamento não entrar na fila já
 * condenado ao 400.
 */
export function buildReadmitSchema(lastExitDate: string | null) {
  return z
    .object({
      entryDate: z.string(),
      // Texto digitado que não forma data (o `DateInput` emite `''`).
      entryDateInvalid: z.boolean().optional(),
    })
    .superRefine((values, ctx) => {
      const issue = (message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['entryDate'], message });

      if (values.entryDateInvalid) return issue(ADD_RESIDENT_DATE_MESSAGES.invalid);
      if (!values.entryDate) return issue(ADD_RESIDENT_DATE_MESSAGES.entryRequired);
      if (isFutureDate(values.entryDate, todayInSaoPaulo())) {
        return issue(ADMISSION_DATE_MESSAGES.entryFuture);
      }
      if (lastExitDate && isDateBefore(values.entryDate, lastExitDate)) {
        issue(ADMISSION_DATE_MESSAGES.entryBeforePreviousExit(lastExitDate));
      }
    });
}

export type ReadmitFormValues = z.infer<ReturnType<typeof buildReadmitSchema>>;

export const buildReadmitDefaults = (): ReadmitFormValues => ({
  entryDate: todayInSaoPaulo(),
  entryDateInvalid: false,
});

/** Busca de candidatos: nome ou CPF, mínimo de 3 caracteres (mesma regra da API). */
export const lookupSearchSchema = z.object({
  term: z.string().trim().min(3, 'Digite ao menos 3 caracteres do nome ou do CPF.'),
});

export type LookupSearchValues = z.infer<typeof lookupSearchSchema>;

/**
 * "Não é nenhum destes": o que foi digitado na busca pré-preenche o cadastro
 * novo — sem letras é CPF, com letras é nome (mesma regra do backend).
 */
export function prefillFromTerm(term: string): { name?: string; cpf?: string } {
  const trimmed = term.trim();
  if (!trimmed) return {};
  // Faixa explícita em vez de `\p{L}`: Unicode property escape não é garantido
  // em todo motor JS do Expo.
  const isCpf = !/[A-Za-zÀ-ÿ]/.test(trimmed) && /\d/.test(trimmed);
  return isCpf ? { cpf: trimmed } : { name: trimmed };
}

import { z } from 'zod';
import {
  ADMISSION_DATE_MESSAGES,
  Gender,
  isAdultBirthDate,
  isDateBefore,
  isFutureDate,
  todayInSaoPaulo,
} from '@fonte/types';

// Schema do "Adicionar filho" da contagem (stories 202, 203 e 209). As regras
// de data são validadas aqui para o lançamento não entrar na fila offline já
// condenado ao 400 do backend.

export const ADD_RESIDENT_DATE_MESSAGES = {
  invalid: 'Data inválida. Use o formato dd/mm/aaaa.',
  entryRequired: 'Informe a data de acolhimento',
  birthFuture: 'A data de nascimento não pode ser no futuro.',
  birthAfterEntry: 'A data de nascimento não pode ser depois da data de acolhimento.',
  // Story 209, decisão 3: maioridade na data de acolhimento (não hoje).
  adultAtEntry: 'O filho precisa ter 18 anos ou mais na data de acolhimento',
} as const;

export const addResidentSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome'),
    // Story 203: entrada não pode ser futura (mesma regra do backend).
    // Obrigatoriedade no `superRefine`: lá dá para dizer "data inválida" em vez
    // de "informe" quando o texto digitado não forma data.
    entryDate: z.string().refine((v) => !isFutureDate(v, todayInSaoPaulo()), {
      message: ADMISSION_DATE_MESSAGES.entryFuture,
    }),
    birthDate: z.string().optional(),
    // Texto digitado que não forma data (o `DateInput` emite `''`): sem estas
    // marcas, nascimento digitado errado passaria como "não informado".
    entryDateInvalid: z.boolean().optional(),
    birthDateInvalid: z.boolean().optional(),
    cpf: z.string().optional(),
    rg: z.string().optional(),
    gender: z.nativeEnum(Gender),
    nationality: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    const issue = (path: 'entryDate' | 'birthDate', message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    if (values.entryDateInvalid) issue('entryDate', ADD_RESIDENT_DATE_MESSAGES.invalid);
    else if (!values.entryDate) issue('entryDate', ADD_RESIDENT_DATE_MESSAGES.entryRequired);
    if (values.birthDateInvalid) {
      issue('birthDate', ADD_RESIDENT_DATE_MESSAGES.invalid);
      return;
    }

    const birth = values.birthDate;
    // Nascimento é opcional: sem ele não há checagem.
    if (!birth) return;
    const today = todayInSaoPaulo();
    if (isFutureDate(birth, today)) {
      issue('birthDate', ADD_RESIDENT_DATE_MESSAGES.birthFuture);
      return;
    }
    const entry = values.entryDate;
    // Sem acolhimento válido não há referência para comparar; o erro do
    // acolhimento já aparece no campo dele.
    if (!entry || values.entryDateInvalid || isFutureDate(entry, today)) return;
    if (isDateBefore(entry, birth)) {
      issue('birthDate', ADD_RESIDENT_DATE_MESSAGES.birthAfterEntry);
    } else if (!isAdultBirthDate(birth, entry)) {
      issue('birthDate', ADD_RESIDENT_DATE_MESSAGES.adultAtEntry);
    }
  });

export type AddResidentFormValues = z.infer<typeof addResidentSchema>;

export const buildAddResidentDefaults = (): AddResidentFormValues => ({
  name: '',
  entryDate: todayInSaoPaulo(),
  birthDate: '',
  entryDateInvalid: false,
  birthDateInvalid: false,
  cpf: '',
  rg: '',
  gender: Gender.MALE,
  nationality: 'Brasileira',
});

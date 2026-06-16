import { z } from 'zod';
import { PayableCategory } from '@fonte/types';

export const payableSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória'),
  /** Valor em reais no formulário; convertido para centavos no submit. */
  amount: z.coerce
    .number({ invalid_type_error: 'Informe um valor' })
    .positive('O valor deve ser maior que zero'),
  dueDate: z.string().min(1, 'Vencimento é obrigatório'),
  category: z.nativeEnum(PayableCategory, {
    errorMap: () => ({ message: 'Selecione uma categoria' }),
  }),
  supplier: z.string().optional(),
  notes: z.string().optional(),
});

export type PayableFormData = z.infer<typeof payableSchema>;

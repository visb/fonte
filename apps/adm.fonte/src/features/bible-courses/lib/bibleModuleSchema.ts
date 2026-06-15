import { z } from 'zod';

export const bibleModuleSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  sequence: z.coerce.number().int('Ordem inválida').min(0, 'Ordem inválida'),
  notes: z.string().optional().or(z.literal('')),
});

export type BibleModuleFormData = z.infer<typeof bibleModuleSchema>;

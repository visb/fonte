import { z } from 'zod';

export const associateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  whatsapp: z
    .string()
    .min(1, 'WhatsApp é obrigatório')
    .regex(/^\+[1-9]\d{1,14}$/, 'Use o formato internacional E.164 (ex.: +5562999998888)'),
  email: z
    .union([z.string().email('E-mail inválido'), z.literal('')])
    .optional(),
  contributionAmount: z.coerce
    .number({ invalid_type_error: 'Informe um valor' })
    .positive('O valor deve ser maior que zero'),
  dueDay: z.coerce
    .number({ invalid_type_error: 'Informe o dia' })
    .int('Use um número inteiro')
    .min(1, 'Entre 1 e 31')
    .max(31, 'Entre 1 e 31'),
});

export type AssociateFormData = z.infer<typeof associateSchema>;

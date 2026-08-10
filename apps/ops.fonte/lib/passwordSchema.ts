import { z } from 'zod';

/**
 * Schema único de definição/alteração de senha (story 173).
 *
 * Compartilhado entre a tela de primeiro acesso (`app/(auth)/change-password.tsx`)
 * e a seção de perfil (`features/profile/components/ChangePasswordSection.tsx`) —
 * as duas telas gravam a mesma senha e não podem divergir na regra.
 */
export const passwordSchema = z
  .object({
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'As senhas não coincidem',
    path: ['confirm'],
  });

export type PasswordForm = z.infer<typeof passwordSchema>;

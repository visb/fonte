import { z } from 'zod';
import { ActivityStatus } from '@fonte/types';
import { canCreateInStatus, type ActivityViewer } from './permissions';

/**
 * Formulário de criação (story 224): título, descrição, coluna e responsável.
 * Em A fazer o responsável é obrigatório (espelha o 400 do backend).
 */
export const newActivitySchema = z
  .object({
    title: z.string().min(1, 'Informe o título'),
    description: z.string().optional(),
    status: z.enum([ActivityStatus.DRAFT, ActivityStatus.REQUESTED, ActivityStatus.TODO]),
    responsibleStaffId: z.string().nullable(),
  })
  .refine((v) => v.status !== ActivityStatus.TODO || !!v.responsibleStaffId, {
    message: 'Escolha o responsável',
    path: ['responsibleStaffId'],
  });

export type NewActivityValues = z.infer<typeof newActivitySchema>;
export type CreatableStatus = NewActivityValues['status'];

/**
 * Coluna inicial do formulário a partir de `?status=` (a aba de onde veio o
 * FAB). Valor desconhecido ou não permitido para quem olha cai em rascunho.
 */
export function resolveCreateStatus(value: unknown, viewer: ActivityViewer): CreatableStatus {
  const allowed =
    typeof value === 'string' &&
    (Object.values(ActivityStatus) as string[]).includes(value) &&
    canCreateInStatus(value as ActivityStatus, viewer);
  return allowed ? (value as CreatableStatus) : ActivityStatus.DRAFT;
}

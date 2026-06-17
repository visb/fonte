import { z } from 'zod';

export const activitySchema = z.object({
  title: z.string().min(1, 'O título é obrigatório'),
  description: z.string().optional(),
  /** '' = sem casa (atividade geral). */
  houseId: z.string().optional(),
});

export type ActivityFormData = z.infer<typeof activitySchema>;

import { z } from 'zod';

export const bibleClassSchema = z
  .object({
    name: z.string().min(1, 'Nome é obrigatório'),
    houseId: z.string().uuid('Casa é obrigatória'),
    startDate: z.string().min(1, 'Data de início é obrigatória'),
    endDate: z.string().min(1, 'Data de término é obrigatória'),
    notes: z.string().optional().or(z.literal('')),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'Término deve ser após o início',
    path: ['endDate'],
  });

export type BibleClassFormData = z.infer<typeof bibleClassSchema>;

/** YYYY-MM-DD string for `daysFrom` days after the given ISO date. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

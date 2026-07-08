import { z } from 'zod';
import type { ProductContributionLineInput } from '@fonte/api-client';

/**
 * Uma linha de contribuição em produtos no formulário de declaração (story 113).
 *
 * O modo (`catalog` | `avulso`) é campo do form — assim o RHF controla o toggle
 * sem `useState` e a validação item-XOR-descrição espelha o backend (story 112):
 *  - `catalog`: exige `inventoryItemId` e `quantity > 0`; a `unit` vem do item.
 *  - `avulso`: exige `description`; `quantity`/`unit` são opcionais (a linha fica
 *    pendente de detalhamento).
 */
export const productLineSchema = z
  .object({
    mode: z.enum(['catalog', 'avulso']),
    inventoryItemId: z.string().optional(),
    description: z.string().optional(),
    quantity: z.string().optional(),
    unit: z.string().optional(),
  })
  .superRefine((line, ctx) => {
    if (line.mode === 'catalog') {
      if (!line.inventoryItemId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['inventoryItemId'], message: 'Selecione um produto' });
      }
      const qty = Number(line.quantity);
      if (!line.quantity || Number.isNaN(qty) || qty <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quantity'], message: 'Quantidade deve ser maior que zero' });
      }
    } else {
      if (!line.description?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['description'], message: 'Informe a descrição' });
      }
    }
  });

export type ProductLineForm = z.infer<typeof productLineSchema>;

/** Linha nova em branco no modo catálogo (default do seletor). */
export function emptyProductLine(): ProductLineForm {
  return { mode: 'catalog', inventoryItemId: '', description: '', quantity: '', unit: '' };
}

/**
 * Converte as linhas do formulário no payload do backend (`lines`), descartando
 * campos irrelevantes ao modo. Catálogo → item + quantity; avulso → description
 * (+ quantity/unit quando informados).
 */
export function toContributionLines(lines: ProductLineForm[]): ProductContributionLineInput[] {
  return lines.map((line) => {
    if (line.mode === 'catalog') {
      return {
        inventoryItemId: line.inventoryItemId,
        quantity: Number(line.quantity),
        unit: line.unit || undefined,
      };
    }
    const qty = line.quantity ? Number(line.quantity) : undefined;
    return {
      description: line.description?.trim(),
      quantity: qty != null && !Number.isNaN(qty) ? qty : undefined,
      unit: line.unit?.trim() || undefined,
    };
  });
}

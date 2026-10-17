import type { AuditEventFilters } from '@fonte/api-client';
import { z } from 'zod';

/** Story 199 — filtros do formulário (datas `YYYY-MM-DD`, demais strings). */
export const auditFiltersSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    action: z.string(),
    houseId: z.string(),
    userId: z.string(),
    outcome: z.enum(['', 'SUCCESS', 'FAILURE']),
    targetId: z
      .string()
      .trim()
      .refine((v) => v === '' || /^[0-9a-f-]{36}$/i.test(v), 'Informe um ID válido'),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: 'O início precisa ser antes do fim',
    path: ['to'],
  });

export type AuditFiltersForm = z.infer<typeof auditFiltersSchema>;

export const EMPTY_AUDIT_FILTERS: AuditFiltersForm = {
  from: '',
  to: '',
  action: '',
  houseId: '',
  userId: '',
  outcome: '',
  targetId: '',
};

/** `YYYY-MM-DD` no horário local → instante ISO (início do dia). */
function localDayStart(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Converte o formulário em filtros da API. O fim é EXCLUSIVO na API, então o
 * dia final selecionado entra inteiro (vai até o início do dia seguinte).
 */
export function toApiFilters(form: AuditFiltersForm): AuditEventFilters {
  const filters: AuditEventFilters = {};
  if (form.from) filters.from = localDayStart(form.from).toISOString();
  if (form.to) {
    const end = localDayStart(form.to);
    end.setDate(end.getDate() + 1);
    filters.to = end.toISOString();
  }
  if (form.action) filters.action = form.action;
  if (form.houseId) filters.houseId = form.houseId;
  if (form.userId) filters.userId = form.userId;
  if (form.outcome) filters.outcome = form.outcome as AuditEventFilters['outcome'];
  if (form.targetId.trim()) filters.targetId = form.targetId.trim();
  return filters;
}

/** Data/hora local legível (dd/mm/aaaa hh:mm:ss). */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

/** Id curto para recursos sem nome (removidos/anonimizados). */
export function shortId(id: string | null): string {
  if (!id) return '—';
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

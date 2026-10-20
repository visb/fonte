import { z } from 'zod';
import {
  isDateBefore,
  isFutureDate,
  STAFF_DISMISSAL_MESSAGES,
  StaffDismissalReason,
  todayInSaoPaulo,
  type DismissStaffPayload,
  type ReinstateStaffPayload,
  type StaffServicePeriod,
} from '@fonte/types';

/**
 * Story 217 — formulários de desligamento e reintegração do servo. As regras e
 * mensagens são as de `@fonte/types`, as mesmas que o backend aplica com 400.
 */

const iso = (value?: string | null) => (value ? value.slice(0, 10) : '');

export interface DismissFormValues {
  date: string;
  reason: StaffDismissalReason | '';
  notes: string;
}

export interface ReinstateFormValues {
  date: string;
  houseId: string;
}

/** Início do período em andamento — o desligamento não pode ser antes dele. */
export function openPeriodStart(periods: readonly StaffServicePeriod[]): string | null {
  const open = periods.find((period) => !period.endDate);
  return open ? iso(open.startDate) : null;
}

/** Fim do último período (ou início do aberto residual) — a reintegração começa a partir dele. */
export function lastPeriodBound(periods: readonly StaffServicePeriod[]): string | null {
  const bounds = periods.map((period) => iso(period.endDate ?? period.startDate)).sort();
  return bounds.pop() ?? null;
}

export function dismissFormDefaults(today = todayInSaoPaulo()): DismissFormValues {
  return { date: today, reason: '', notes: '' };
}

export function makeDismissFormSchema(options: { periods?: readonly StaffServicePeriod[]; today?: string }) {
  const today = options.today ?? todayInSaoPaulo();
  const start = openPeriodStart(options.periods ?? []);
  return z
    .object({
      date: z.string().min(1, 'Informe a data do desligamento.'),
      reason: z.string().min(1, 'Selecione o motivo.'),
      notes: z.string().max(2000, 'Máximo de 2000 caracteres.'),
    })
    .superRefine((values, ctx) => {
      const issue = (path: keyof DismissFormValues, message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
      if (values.reason === StaffDismissalReason.OTHER && !values.notes.trim()) {
        issue('notes', STAFF_DISMISSAL_MESSAGES.notesRequired);
      }
      if (!values.date) return;
      if (isFutureDate(values.date, today)) return issue('date', STAFF_DISMISSAL_MESSAGES.dateFuture);
      if (start && isDateBefore(values.date, start)) {
        issue('date', STAFF_DISMISSAL_MESSAGES.dateBeforeStart(start));
      }
    });
}

export function toDismissPayload(values: DismissFormValues): DismissStaffPayload {
  return {
    date: values.date,
    reason: values.reason as StaffDismissalReason,
    notes: values.notes.trim() || null,
  };
}

export function reinstateFormDefaults(houseId?: string | null, today = todayInSaoPaulo()): ReinstateFormValues {
  return { date: today, houseId: houseId ?? '' };
}

export function makeReinstateFormSchema(options: { periods?: readonly StaffServicePeriod[]; today?: string }) {
  const today = options.today ?? todayInSaoPaulo();
  const bound = lastPeriodBound(options.periods ?? []);
  return z
    .object({
      date: z.string().min(1, 'Informe a data de reintegração.'),
      houseId: z.string(),
    })
    .superRefine((values, ctx) => {
      const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['date'], message });
      if (!values.date) return;
      if (isFutureDate(values.date, today)) return issue(STAFF_DISMISSAL_MESSAGES.reinstateFuture);
      if (bound && isDateBefore(values.date, bound)) issue(STAFF_DISMISSAL_MESSAGES.reinstateBeforeLastEnd(bound));
    });
}

export function toReinstatePayload(values: ReinstateFormValues): ReinstateStaffPayload {
  return { date: values.date, houseId: values.houseId || null };
}

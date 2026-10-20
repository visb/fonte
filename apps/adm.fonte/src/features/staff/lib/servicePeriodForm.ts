import { z } from 'zod';
import {
  findServicePeriodDatesIssue,
  findServicePeriodOverlap,
  SERVICE_PERIOD_MESSAGES,
  todayInSaoPaulo,
  type CreateServicePeriodPayload,
  type StaffServicePeriod,
  type UpdateServicePeriodPayload,
} from '@fonte/types';

/**
 * Story 216 — formulário de período de serviço da aba Histórico. As regras são
 * as de `@fonte/types`, as mesmas que o backend aplica com 400:
 *
 * - `create`: período antigo, já encerrado (início + fim; casa opcional);
 * - `edit`: período encerrado — casa, início e fim;
 * - `open`: período em andamento — só o início (o fim é do desligamento).
 *
 * Datas só são julgadas quando mudaram (mesma linha da story 203); a
 * sobreposição é julgada contra os outros períodos do servo.
 */
export type ServicePeriodFormMode = 'create' | 'edit' | 'open';

export interface ServicePeriodFormValues {
  houseId: string;
  startDate: string;
  endDate: string;
}

const iso = (value?: string | null) => (value ? value.slice(0, 10) : '');

export function servicePeriodFormMode(period?: StaffServicePeriod | null): ServicePeriodFormMode {
  if (!period) return 'create';
  return period.endDate ? 'edit' : 'open';
}

export function servicePeriodFormDefaults(period?: StaffServicePeriod | null): ServicePeriodFormValues {
  return {
    houseId: period?.houseId ?? '',
    startDate: iso(period?.startDate),
    endDate: iso(period?.endDate),
  };
}

export function makeServicePeriodFormSchema(options: {
  mode: ServicePeriodFormMode;
  period?: StaffServicePeriod | null;
  periods?: readonly StaffServicePeriod[];
  today?: string;
}) {
  const { mode, period } = options;
  const initial = period ? servicePeriodFormDefaults(period) : undefined;

  return z
    .object({
      houseId: z.string(),
      startDate: z.string().min(1, 'Informe a data de início.'),
      endDate: z.string(),
    })
    .superRefine((values, ctx) => {
      const issue = (path: keyof ServicePeriodFormValues, message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

      const endDate = mode === 'open' ? '' : values.endDate;
      if (mode !== 'open' && !endDate) {
        issue('endDate', SERVICE_PERIOD_MESSAGES.endDateRequired);
        return;
      }
      const changed =
        !initial || values.startDate !== initial.startDate || endDate !== initial.endDate;
      if (!values.startDate || !changed) return;

      const dates = findServicePeriodDatesIssue(
        { startDate: values.startDate, endDate },
        options.today ?? todayInSaoPaulo(),
      );
      if (dates) return issue(dates.field, dates.message);

      const overlap = findServicePeriodOverlap(
        { id: period?.id, startDate: values.startDate, endDate: endDate || null },
        options.periods ?? [],
      );
      if (overlap) {
        issue('startDate', SERVICE_PERIOD_MESSAGES.overlap(overlap.startDate, overlap.endDate));
      }
    });
}

export function toCreateServicePeriodPayload(values: ServicePeriodFormValues): CreateServicePeriodPayload {
  return {
    houseId: values.houseId || null,
    startDate: values.startDate,
    endDate: values.endDate,
  };
}

/** Só o que mudou — o backend julga só o que veio. No aberto, só o início. */
export function toUpdateServicePeriodPayload(
  values: ServicePeriodFormValues,
  period: StaffServicePeriod,
): UpdateServicePeriodPayload {
  const initial = servicePeriodFormDefaults(period);
  const payload: UpdateServicePeriodPayload = {};
  if (values.startDate !== initial.startDate) payload.startDate = values.startDate;
  if (servicePeriodFormMode(period) === 'open') return payload;
  if (values.houseId !== initial.houseId) payload.houseId = values.houseId || null;
  if (values.endDate !== initial.endDate) payload.endDate = values.endDate;
  return payload;
}

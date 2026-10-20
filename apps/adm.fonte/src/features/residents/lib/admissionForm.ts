import { z } from 'zod';
import {
  ADMISSION_EXIT_STATUSES,
  ADMISSION_HISTORY_MESSAGES,
  findAdmissionOverlap,
  ResidentStatus,
  type CreateAdmissionPayload,
  type UpdateAdmissionPayload,
} from '@fonte/types';
import type { Admission } from '@fonte/api-client';
import { refineAdmissionDates } from './admissionDates';

/**
 * Story 215 — formulário de passagem da aba Histórico. As regras são as de
 * `@fonte/types`, as mesmas que o backend aplica com 400:
 *
 * - `create`: passagem antiga, já encerrada (entrada + saída + status de saída);
 * - `edit`: passagem encerrada — casa, datas e status;
 * - `current`: acolhimento atual — só a entrada (decisão 5).
 *
 * Sobreposição e "começar antes do atual" são julgadas contra as outras
 * passagens do filho (a própria não conta).
 */
export type AdmissionFormMode = 'create' | 'edit' | 'current';

export interface AdmissionFormValues {
  houseId: string;
  entryDate: string;
  exitDate: string;
  status: string;
}

const iso = (value?: string | null) => (value ? value.slice(0, 10) : '');

export function admissionFormDefaults(admission?: Admission | null): AdmissionFormValues {
  return {
    houseId: admission?.houseId ?? '',
    entryDate: iso(admission?.entryDate),
    exitDate: iso(admission?.exitDate),
    status: admission && ADMISSION_EXIT_STATUSES.includes(admission.status as ResidentStatus) ? admission.status : '',
  };
}

export function makeAdmissionFormSchema(options: {
  mode: AdmissionFormMode;
  admission?: Admission | null;
  admissions?: readonly Admission[];
  today?: string;
}) {
  const { mode, admission } = options;
  const admissions = options.admissions ?? [];
  const initial = admission ? admissionFormDefaults(admission) : undefined;
  const current = admissions[0];

  return z
    .object({
      houseId: z.string(),
      entryDate: z.string().min(1, 'Informe a data de entrada.'),
      exitDate: z.string(),
      status: z.string(),
    })
    .superRefine((values, ctx) => {
      const issue = (path: keyof AdmissionFormValues, message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

      if (mode !== 'current') {
        if (!values.exitDate) issue('exitDate', ADMISSION_HISTORY_MESSAGES.exitDateRequired);
        if (!ADMISSION_EXIT_STATUSES.includes(values.status as ResidentStatus)) {
          issue('status', ADMISSION_HISTORY_MESSAGES.exitStatusRequired);
        } else if (!values.houseId && values.status !== ResidentStatus.ARCHIVED) {
          issue('houseId', ADMISSION_HISTORY_MESSAGES.houseRequired);
        }
      }

      const exitDate = mode === 'current' ? iso(admission?.exitDate) : values.exitDate;
      const dates = { entryDate: values.entryDate, exitDate };
      refineAdmissionDates(dates, ctx, { initial, today: options.today });

      const datesChanged =
        !initial || values.entryDate !== initial.entryDate || exitDate !== initial.exitDate;
      if (!values.entryDate || !datesChanged) return;

      const entryChanged = !initial || values.entryDate !== initial.entryDate;
      const currentEntry = iso(current?.entryDate);
      if (mode !== 'current' && entryChanged && currentEntry && current?.id !== admission?.id) {
        if (values.entryDate >= currentEntry) {
          issue('entryDate', ADMISSION_HISTORY_MESSAGES.afterCurrent(currentEntry));
          return;
        }
      }

      const overlap = findAdmissionOverlap(
        { id: admission?.id, entryDate: values.entryDate, exitDate: exitDate || null },
        admissions,
      );
      if (overlap) {
        issue('entryDate', ADMISSION_HISTORY_MESSAGES.overlap(overlap.entryDate, overlap.exitDate));
      }
    });
}

export function toCreateAdmissionPayload(values: AdmissionFormValues): CreateAdmissionPayload {
  return {
    houseId: values.houseId || null,
    entryDate: values.entryDate,
    exitDate: values.exitDate,
    status: values.status as ResidentStatus,
  };
}

/** Só o que mudou — o backend julga só o que veio (mesma linha da story 203). */
export function toUpdateAdmissionPayload(
  values: AdmissionFormValues,
  admission: Admission,
  mode: AdmissionFormMode,
): UpdateAdmissionPayload {
  const initial = admissionFormDefaults(admission);
  const payload: UpdateAdmissionPayload = {};
  if (values.entryDate !== initial.entryDate) payload.entryDate = values.entryDate;
  if (mode === 'current') return payload;
  if (values.houseId !== initial.houseId) payload.houseId = values.houseId || null;
  if (values.exitDate !== initial.exitDate) payload.exitDate = values.exitDate;
  if (values.status !== admission.status) payload.status = values.status as ResidentStatus;
  return payload;
}

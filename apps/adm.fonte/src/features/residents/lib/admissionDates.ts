import { z } from 'zod';
import { findAdmissionDatesIssue, todayInSaoPaulo, type AdmissionDatesIssue } from '@fonte/types';

/**
 * Story 203 — coerência das datas de entrada e saída. A regra é a de
 * `@fonte/types`, a mesma que o backend aplica com 400.
 *
 * `initial` é o par carregado na edição. Só julga a data que mudou
 * (decisão 4): ficha legada incoerente com nenhuma das datas alterada salva
 * normalmente. Na criação (sem `initial`) toda data informada é julgada.
 * O erro vai para o campo que mudou — o par incoerente aparece na saída quando
 * ela foi mexida e na entrada quando só a entrada mudou.
 */
export function admissionDatesIssue(
  values: { entryDate?: string | null; exitDate?: string | null },
  options: {
    initial?: { entryDate?: string | null; exitDate?: string | null };
    previousExitDate?: string | null;
    today?: string;
  } = {},
): AdmissionDatesIssue | null {
  const iso = (v?: string | null) => (v ? v.slice(0, 10) : '');
  const entry = iso(values.entryDate);
  const exit = iso(values.exitDate);
  const { initial } = options;
  const checkEntry = !initial || entry !== iso(initial.entryDate);
  const checkExit = !initial || exit !== iso(initial.exitDate);
  if (!checkEntry && !checkExit) return null;

  const issue = findAdmissionDatesIssue(
    { entryDate: entry, exitDate: exit },
    {
      today: options.today ?? todayInSaoPaulo(),
      previousExitDate: options.previousExitDate ? iso(options.previousExitDate) : null,
      check: { entryDate: checkEntry, exitDate: checkExit },
    },
  );
  if (issue && issue.field === 'exitDate' && !checkExit) {
    return { ...issue, field: 'entryDate' };
  }
  return issue;
}

/**
 * Saída da última passagem encerrada (readmissão, decisão 6): a maior entre as
 * admissões do histórico e o espelho na ficha. `null` sem saída registrada.
 */
export function lastExitDate(
  admissions: ReadonlyArray<{ exitDate?: string | null }> = [],
  residentExitDate?: string | null,
): string | null {
  const dates = [...admissions.map((a) => a.exitDate), residentExitDate]
    .filter((d): d is string => !!d)
    .map((d) => d.slice(0, 10))
    .sort();
  return dates.length ? dates[dates.length - 1] : null;
}

/**
 * Import em lote (decisão 7): mensagem de cada passagem do histórico (ou
 * `null` quando válida), na mesma ordem. Sobreposição entre passagens não é
 * julgada.
 */
export function importAdmissionsIssues(
  admissions: ReadonlyArray<{ entryDate?: string | null; exitDate?: string | null }>,
  today: string = todayInSaoPaulo(),
): (string | null)[] {
  return admissions.map((a) => admissionDatesIssue(a, { today })?.message ?? null);
}

/** Adiciona ao `ctx` do `superRefine` o erro de datas, no campo certo. */
export function refineAdmissionDates(
  values: { entryDate?: string | null; exitDate?: string | null },
  ctx: z.RefinementCtx,
  options: Parameters<typeof admissionDatesIssue>[1] = {},
): void {
  const issue = admissionDatesIssue(values, options);
  if (issue) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [issue.field], message: issue.message });
  }
}

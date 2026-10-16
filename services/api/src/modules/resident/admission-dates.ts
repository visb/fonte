import { BadRequestException } from '@nestjs/common';
import { findAdmissionDatesIssue, todayInSaoPaulo } from '@fonte/types';

type DateValue = string | Date | null | undefined;

interface AdmissionDates {
  entryDate?: DateValue;
  exitDate?: DateValue;
}

/** `YYYY-MM-DD` de um valor vindo do DTO (string) ou da entidade (Date/string). */
function toIsoDate(value: DateValue): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

/**
 * Story 203 — coerência das datas de entrada e saída do acolhimento.
 *
 * - entrada não pode ser futura; saída também não (alta/evasão registram fato);
 * - saída ≥ entrada (mesmo dia pode);
 * - `previousExitDate` (readmissão): entrada ≥ saída da passagem anterior.
 *
 * `previous` é o par gravado (edição). Com ele, só julga a data que veio no
 * payload **e** mudou (decisão 4): ficha legada incoerente continua salvável
 * editando outro campo, e o reenvio idempotente da outbox não revalida. Quando
 * uma das duas muda, a coerência do par resultante (gravado ∪ payload) é
 * checada. Sem `previous` (criação), julga tudo o que veio.
 *
 * Chamar **antes** de persistir e de qualquer efeito colateral.
 */
export function assertAdmissionDates(
  next: AdmissionDates,
  options: {
    previous?: AdmissionDates;
    today?: string;
    previousExitDate?: DateValue;
  } = {},
): void {
  const { previous } = options;
  const nextEntry = toIsoDate(next.entryDate);
  const nextExit = toIsoDate(next.exitDate);

  let entryDate = nextEntry;
  let exitDate = nextExit;
  let checkEntry = next.entryDate !== undefined;
  let checkExit = next.exitDate !== undefined;

  if (previous) {
    const prevEntry = toIsoDate(previous.entryDate);
    const prevExit = toIsoDate(previous.exitDate);
    checkEntry = checkEntry && nextEntry !== prevEntry;
    checkExit = checkExit && nextExit !== prevExit;
    if (next.entryDate === undefined) entryDate = prevEntry;
    if (next.exitDate === undefined) exitDate = prevExit;
  }
  if (!checkEntry && !checkExit) return;

  const issue = findAdmissionDatesIssue(
    { entryDate, exitDate },
    {
      today: options.today ?? todayInSaoPaulo(),
      previousExitDate: toIsoDate(options.previousExitDate),
      check: { entryDate: checkEntry, exitDate: checkExit },
    },
  );
  if (issue) throw new BadRequestException(issue.message);
}

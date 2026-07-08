import { ResidentStatus } from '@fonte/types';

/**
 * Meses completos entre duas datas ISO (`YYYY-MM-DD`; datetime também aceito,
 * só a parte da data conta). Um mês só conta quando o dia final alcança o dia
 * inicial — 5 meses e 29 dias contam como 5. `exit < entry` → 0 (nunca negativo).
 */
export function monthsBetween(startIso: string, endIso: string): number {
  const s = new Date(`${startIso.slice(0, 10)}T00:00:00Z`);
  const e = new Date(`${endIso.slice(0, 10)}T00:00:00Z`);
  let months = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth());
  if (e.getUTCDate() < s.getUTCDate()) months -= 1; // mês incompleto no fim não conta
  return Math.max(0, months);
}

/**
 * Status terminal de um acolhimento fechado, derivado pela permanência
 * entrada→saída (story 120): ≥ 6 meses → alta (`DISCHARGED`); < 6 meses → evasão
 * (`EVADED`). Fonte única usada tanto pelo topo do resident quanto pelos
 * acolhimentos anteriores do histórico (story 121).
 */
export function deriveExitStatus(
  entryIso: string,
  exitIso: string,
): ResidentStatus.DISCHARGED | ResidentStatus.EVADED {
  return monthsBetween(entryIso, exitIso) >= 6
    ? ResidentStatus.DISCHARGED
    : ResidentStatus.EVADED;
}

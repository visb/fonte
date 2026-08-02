/**
 * Datas relativas ao `now()` da execução, para e2e que batem em endpoints que
 * filtram por data (story 155).
 *
 * Literal de data em teste que compara com `now()` é falha agendada: enquanto
 * "hoje" é anterior ao literal o registro é futuro e aparece na listagem; depois
 * ele vira passado e o endpoint — corretamente — para de devolvê-lo. Foi o que
 * apodreceu `events.e2e-spec.ts` em 2026-08-02.
 *
 * Offsets em DIAS e com margem folgada (±15, ±30) de propósito: a suíte não pode
 * ficar sensível a fuso horário, relógio da máquina ou execução lenta.
 */
export function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

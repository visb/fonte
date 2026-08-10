/** Formatação da fila de sincronização (story 170). */

/**
 * Horário de entrada na fila. Mostra só a hora quando é de hoje — o operador
 * quer distinguir "o que acabei de lançar" de "o que está preso desde ontem".
 */
export function formatQueuedAt(timestamp: number, now: Date = new Date()): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (isToday) return time;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month} ${time}`;
}

/** Plural simples para as contagens da tela ("1 lançamento" / "2 lançamentos"). */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

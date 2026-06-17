const fmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Exibição amigável do intervalo do evento (início – fim, ou só início). */
export function formatEventDate(startAt: string, endAt: string | null): string {
  const start = fmt.format(new Date(startAt));
  if (!endAt) return start;
  return `${start} – ${fmt.format(new Date(endAt))}`;
}

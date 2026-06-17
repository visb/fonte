/** Converte ISO (UTC) para o valor de um <input type="datetime-local"> em hora local. */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** Converte o valor de um datetime-local (hora local) para ISO (UTC), ou null se vazio. */
export function localInputToIso(value?: string | null): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

/** Exibição amigável do intervalo do evento (início – fim, ou só início). */
export function formatEventDateRange(startAt: string, endAt: string | null): string {
  const start = dateTimeFmt.format(new Date(startAt));
  if (!endAt) return start;
  return `${start} – ${dateTimeFmt.format(new Date(endAt))}`;
}

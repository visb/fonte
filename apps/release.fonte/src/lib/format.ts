/** "2026-10-20" → "20/10/2026". Sem `new Date()`: evita o deslocamento de fuso. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

/** Tamanho em MB com vírgula decimal (pt-BR): 73400320 → "70,0 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

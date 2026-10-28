/**
 * Daily — board de ministérios em tempo real (story 225).
 * Labels, cores e parâmetros de gesto/exibição do slice.
 */

/** Long-press antes de o card começar a flutuar (decisão 12). */
export const DAILY_LONG_PRESS_MS = 300;

/** Faixa (px) nas bordas da lista que dispara o auto-scroll durante o arrasto. */
export const DAILY_AUTO_SCROLL_EDGE = 72;

/** Passo máximo (px por quadro) do auto-scroll. */
export const DAILY_AUTO_SCROLL_MAX_STEP = 18;

/** Chave da caixa "Sem ministério" nas estruturas de layout/drop. */
export const UNASSIGNED_KEY = '__unassigned__';

export const DAILY_LABELS = {
  title: 'Daily',
  unassigned: 'Sem ministério',
  apply: 'Aplicar',
  newDaily: 'Nova daily',
  moveTo: 'Mover para…',
  offline: 'A daily precisa de conexão. O board fica somente leitura até o sinal voltar.',
  empty: 'Nenhum filho ou servo na casa.',
  loadError: 'Não foi possível abrir a daily.',
  moveError: 'Não foi possível mover.',
  applyError: 'Não foi possível aplicar a daily.',
  startError: 'Não foi possível abrir uma nova daily.',
  applyConfirmTitle: 'Aplicar a daily?',
  skippedTitle: 'Não aplicados (deixaram de ser elegíveis):',
  readOnlyApplied: 'Daily aplicada — somente leitura.',
} as const;

/** "1 mudança" / "N mudanças" nos ministérios — texto da confirmação. */
export function changesLabel(count: number): string {
  return count === 1 ? '1 mudança nos ministérios' : `${count} mudanças nos ministérios`;
}

/** Aviso do servo que hoje está em vários ministérios (decisão 2). */
export function multipleMinistriesLabel(count: number): string {
  return `estava em ${count} ministérios`;
}

/** Badge de papel do staff sem nível (ADMIN/COORDINATOR) — decisão 6. */
export const DAILY_ROLE_BADGE = { color: '#7c2d12', bg: '#ffedd5' } as const;

/** Iniciais para o avatar sem foto. */
export function personInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

/** "Aplicado às 14:05 por Fulano". */
export function appliedLabel(appliedAt: string | null, appliedByName: string | null): string {
  if (!appliedAt) return 'Aplicado';
  const d = new Date(appliedAt);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return appliedByName ? `Aplicado às ${hh}:${mm} por ${appliedByName}` : `Aplicado às ${hh}:${mm}`;
}

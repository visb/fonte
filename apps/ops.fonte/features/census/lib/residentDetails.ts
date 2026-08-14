import { ResidentStatus } from '@fonte/types';
import { STATUS_CONFIG } from '@/lib/constants';

/**
 * Formatadores do modal de detalhes da contagem (story 179).
 *
 * Ficam fora do componente porque são regra de exibição pura — e porque o
 * cálculo de idade é o tipo de coisa que só se confere com teste.
 */

/** `2026-03-10` (ou ISO completo) → `10/03/2026`. */
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [year, month, day] = iso.split('T')[0].split('-');
  if (!year || !month || !day) return null;
  return `${day}/${month}/${year}`;
}

/** Idade em anos completos na data de referência (hoje, por padrão). */
export function ageInYears(iso: string | null | undefined, today = new Date()): number | null {
  if (!iso) return null;
  const [year, month, day] = iso.split('T')[0].split('-').map(Number);
  if (!year || !month || !day) return null;
  let age = today.getFullYear() - year;
  const monthDiff = today.getMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) age -= 1;
  return age < 0 ? null : age;
}

/** `10/03/1990 · 36 anos` — nada quando não há data de nascimento. */
export function formatBirthDate(iso: string | null | undefined, today = new Date()): string | null {
  const date = formatDate(iso);
  if (!date) return null;
  const age = ageInYears(iso, today);
  return age === null ? date : `${date} · ${age} ${age === 1 ? 'ano' : 'anos'}`;
}

/**
 * Rótulo do status na contagem. `CENSUS_ADDED` não está no `STATUS_CONFIG`
 * global (é situação transitória, só existe durante a contagem), então ganha o
 * mesmo rótulo do badge da lista em vez de vazar o código cru na tela.
 */
export function censusStatusLabel(status: string): string {
  if (status === ResidentStatus.CENSUS_ADDED) return 'Aguardando aprovação';
  return STATUS_CONFIG[status]?.label ?? status;
}

/** Cor do status, com o mesmo fallback cinza das outras listas do app. */
export function censusStatusColor(status: string): string {
  if (status === ResidentStatus.CENSUS_ADDED) return '#b45309';
  return STATUS_CONFIG[status]?.color ?? '#6b7280';
}

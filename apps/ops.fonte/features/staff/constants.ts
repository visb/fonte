import { Role } from '@fonte/types';
import type { HouseStaffMember } from '@fonte/api-client';

/** Rótulo do papel do servo na lista *Servos* (story 204). */
export const STAFF_ROLE_LABELS: Partial<Record<Role, string>> = {
  [Role.ADMIN]: 'Administrador',
  [Role.COORDINATOR]: 'Coordenador',
  [Role.SERVANT]: 'Servo',
};

export const STAFF_ROLE_BADGE: Partial<Record<Role, { color: string; bg: string }>> = {
  [Role.ADMIN]: { color: '#475569', bg: '#f1f5f9' },
  [Role.COORDINATOR]: { color: '#0369a1', bg: '#f0f9ff' },
  [Role.SERVANT]: { color: '#16a34a', bg: '#f0fdf4' },
};

export function staffRoleLabel(role: Role): string {
  return STAFF_ROLE_LABELS[role] ?? role;
}

/** Decisão 8: coordenadores primeiro, depois servos; por nome dentro do grupo. */
const ROLE_ORDER: Partial<Record<Role, number>> = {
  [Role.COORDINATOR]: 0,
  [Role.SERVANT]: 1,
};

export function sortHouseStaff(staff: HouseStaffMember[]): HouseStaffMember[] {
  return [...staff].sort((a, b) => {
    const byRole = (ROLE_ORDER[a.role] ?? 2) - (ROLE_ORDER[b.role] ?? 2);
    return byRole !== 0 ? byRole : a.name.localeCompare(b.name, 'pt-BR');
  });
}

/**
 * Decisão 7: `https://wa.me/<número com 55>`. Só dígitos; número nacional
 * (10–11 dígitos, com DDD) ganha o 55. Sem dígito nenhum → `null` (sem botão).
 */
export function whatsappUrl(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const withCountry = digits.startsWith('55') && digits.length > 11 ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}

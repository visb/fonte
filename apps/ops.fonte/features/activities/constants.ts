import { ActivityStatus } from '@fonte/types';

/**
 * Espelha a matriz de criação do backend (story 48). No ops, o staff (não-ADMIN)
 * só cria em rascunho (`DRAFT`). Quick-add só pede o título, então só aparece em
 * colunas que NÃO exigem campo adicional — ou seja, apenas `DRAFT`.
 *
 * O `role` é recebido para manter a regra alinhada à matriz e fácil de ajustar
 * caso a permissão por status passe a depender do papel.
 */
export function canQuickAddInStatus(
  status: ActivityStatus,
  _role: string | null | undefined,
): boolean {
  return status === ActivityStatus.DRAFT;
}

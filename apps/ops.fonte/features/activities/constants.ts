import { ActivityStatus } from '@fonte/types';

/**
 * Colunas do quadro de atividades (story 208): uma aba por status, na ordem do
 * board do `adm` e do backend. Fonte única de ordem e rótulo das abas.
 */
export const ACTIVITY_COLUMNS: readonly { status: ActivityStatus; title: string }[] = [
  { status: ActivityStatus.DRAFT, title: 'Rascunhos' },
  { status: ActivityStatus.REQUESTED, title: 'Solicitações' },
  { status: ActivityStatus.TODO, title: 'A fazer' },
  { status: ActivityStatus.DOING, title: 'Fazendo' },
  { status: ActivityStatus.BLOCKED, title: 'Impedimento' },
  { status: ActivityStatus.DONE, title: 'Concluídas' },
];

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

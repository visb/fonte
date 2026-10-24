import { useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { isHouseCoordinatorRole } from '@/lib/houseCoordinator';
import { useHouseById } from '@/features/house-settings/hooks/useHouseSettings';
import {
  buildMenuItems,
  buildQuickActions,
  canAccessMenuItem,
  type AppMenuItem,
  type MenuAccess,
  type MenuItemKey,
  type QuickActionItem,
} from '../constants';

/**
 * ViewModel de acesso (story 176): junta o que o `useAuth` sabe com a casa do
 * coordenador — a mesma consulta que o dashboard já fazia — e devolve o
 * catálogo filtrado. Menu e ações rápidas passam a ler daqui, então não existe
 * mais chance de o dashboard e o menu discordarem sobre o que o usuário pode
 * abrir.
 *
 * Sem fetch novo: `useHouseById` só dispara para coordenador (`enabled`) e já
 * está no cache/pacote da casa do offline-first.
 */
export function useMenuAccess(): {
  access: MenuAccess;
  menuItems: AppMenuItem[];
  quickActions: QuickActionItem[];
  /** Story 221: a mesma regra do catálogo, para telas que decidem um toque (cards). */
  canAccess: (key: MenuItemKey) => boolean;
} {
  const { staff, isResident, canSendMessagesToFamilies, canModerateMessages } = useAuth();

  const isSupportGroupServant = !!staff && !staff.houseId;
  // Story 214: ADMIN lotado na casa também é coordenador dela (COORDINATOR | ADMIN).
  const isCoordinator = isHouseCoordinatorRole(staff?.user?.role);

  const { data: house } = useHouseById(staff?.houseId, { enabled: isCoordinator });

  // Story 194: o gate é o vínculo com a casa, não a eleição de titular — dos N
  // coordenadores da casa, todos configuram; o `coordinator_id` é só a
  // referência/contato (decisão 4). Espelha o gate da HouseSettingsPage.
  const isHouseCoordinator = !!isCoordinator && !!house && house.id === staff?.houseId;

  const access = useMemo<MenuAccess>(
    () => ({
      isResident,
      isSupportGroupServant,
      isCoordinator: !!isCoordinator,
      isHouseCoordinator,
      canSendMessagesToFamilies,
      canModerateMessages,
    }),
    [
      isResident,
      isSupportGroupServant,
      isCoordinator,
      isHouseCoordinator,
      canSendMessagesToFamilies,
      canModerateMessages,
    ],
  );

  return useMemo(
    () => ({
      access,
      menuItems: buildMenuItems(access),
      quickActions: buildQuickActions(access),
      canAccess: (key: MenuItemKey) => canAccessMenuItem(key, access),
    }),
    [access],
  );
}

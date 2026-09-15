import { useMemo } from 'react';
import { Role } from '@fonte/types';
import { useAuth } from '@/lib/auth';
import { useHouseById } from '@/features/house-settings/hooks/useHouseSettings';
import {
  buildMenuItems,
  buildQuickActions,
  type AppMenuItem,
  type MenuAccess,
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
} {
  const { staff, isResident, canSendMessagesToFamilies, canModerateMessages } = useAuth();

  const isSupportGroupServant = !!staff && !staff.houseId;
  const isCoordinator = staff?.user?.role === Role.COORDINATOR;

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
    }),
    [access],
  );
}

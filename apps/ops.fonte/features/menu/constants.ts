import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Catálogo único de navegação do app (story 176).
 *
 * Antes da tab "Menu" existiam duas listas de rotas — os `href` condicionais do
 * `app/(app)/_layout.tsx` e a lista local das ações rápidas do dashboard. Duas
 * fontes de verdade viram item que leva a tela proibida, então tudo passa por
 * aqui: o menu, as ações rápidas e a visibilidade das tabs consultam o mesmo
 * `canAccessMenuItem`.
 */

export type MenuSectionKey = 'casa' | 'estoque' | 'comunicacao' | 'conta';

export const MENU_SECTIONS: { key: MenuSectionKey; label: string }[] = [
  { key: 'casa', label: 'Casa' },
  { key: 'estoque', label: 'Estoque' },
  { key: 'comunicacao', label: 'Comunicação' },
  { key: 'conta', label: 'Conta' },
];

export const MENU_ITEM_KEYS = [
  'contributions',
  'residents',
  'staff',
  'incidents',
  'activities',
  'ministries',
  'daily',
  'events',
  'census',
  'houseSettings',
  'storeroom',
  'supplyRoom',
  'streetSales',
  'messages',
  'wishlist',
  'supportGroups',
  'sync',
] as const;

export type MenuItemKey = (typeof MENU_ITEM_KEYS)[number];

export interface AppMenuItem {
  key: MenuItemKey;
  label: string;
  icon: IoniconName;
  route: string;
  section: MenuSectionKey;
  color: string;
  bg: string;
  /** Rótulo/rota que a ação rápida do dashboard usa quando difere do menu. */
  quickAction?: { label?: string; route?: string };
}

/**
 * Perfil de acesso do usuário logado. Espelha exatamente as condições que o
 * `_layout.tsx` usava nos `href` e as flags que o `DashboardPage` calculava.
 */
export interface MenuAccess {
  isResident: boolean;
  isSupportGroupServant: boolean;
  isCoordinator: boolean;
  isHouseCoordinator: boolean;
  canSendMessagesToFamilies: boolean;
  canModerateMessages: boolean;
}

export const MENU_ITEMS: AppMenuItem[] = [
  {
    key: 'contributions', label: 'Contribuições', icon: 'gift-outline',
    route: '/(app)/contributions', section: 'casa', color: '#16a34a', bg: '#f0fdf4',
    quickAction: { label: 'Nova contribuição', route: '/(app)/contributions/pick-resident' },
  },
  {
    key: 'residents',
    label: 'Filhos',
    icon: 'people-outline',
    route: '/(app)/residents',
    section: 'casa',
    color: '#9333ea',
    bg: '#faf5ff',
    quickAction: { label: 'Ver filhos' },
  },
  {
    // Story 204: lista de servos da casa (somente leitura + WhatsApp). Sem ação
    // rápida no dashboard; o gate é o default `isHouseStaff`.
    key: 'staff',
    label: 'Servos',
    icon: 'id-card-outline',
    route: '/(app)/staff',
    section: 'casa',
    color: '#0f766e',
    bg: '#f0fdfa',
  },
  {
    key: 'incidents',
    label: 'Ocorrências',
    icon: 'warning-outline',
    route: '/(app)/incidents',
    section: 'casa',
    color: '#dc2626',
    bg: '#fef2f2',
    quickAction: { label: 'Nova ocorrência', route: '/(app)/incidents/new' },
  },
  {
    key: 'activities',
    label: 'Atividades',
    icon: 'checkbox-outline',
    route: '/(app)/activities',
    section: 'casa',
    color: '#4f46e5',
    bg: '#eef2ff',
  },
  {
    key: 'ministries',
    label: 'Ministérios',
    icon: 'people-circle-outline',
    route: '/(app)/ministries',
    section: 'casa',
    color: '#0369a1',
    bg: '#f0f9ff',
  },
  {
    // Story 225: board da daily — só ADMIN/COORDINATOR (gate em canAccessMenuItem).
    key: 'daily',
    label: 'Daily',
    icon: 'git-compare-outline',
    route: '/(app)/daily',
    section: 'casa',
    color: '#0e7490',
    bg: '#ecfeff',
  },
  // Escondido do menu por ora (vai voltar): as rotas continuam no app.
  // {
  //   key: 'events',
  //   label: 'Eventos internos',
  //   icon: 'calendar-outline',
  //   route: '/(app)/events',
  //   section: 'casa',
  //   color: '#7c3aed',
  //   bg: '#f5f3ff',
  // },
  {
    key: 'census',
    label: 'Contagem',
    icon: 'checkbox-outline',
    route: '/(app)/census',
    section: 'casa',
    color: '#0d9488',
    bg: '#f0fdfa',
  },
  {
    key: 'houseSettings',
    label: 'Configurações da casa',
    icon: 'settings-outline',
    route: '/(app)/house-settings',
    section: 'casa',
    color: '#475569',
    bg: '#f1f5f9',
  },
  // Seção "Estoque" escondida do menu por ora (vai voltar): as rotas continuam
  // no app e a seção some sozinha no MenuPage por não ter item.
  // {
  //   key: 'storeroom',
  //   label: 'Dispensa',
  //   icon: 'cube-outline',
  //   route: '/(app)/storeroom',
  //   section: 'estoque',
  //   color: '#16a34a',
  //   bg: '#f0fdf4',
  // },
  // {
  //   key: 'supplyRoom',
  //   label: 'Almoxarifado',
  //   icon: 'sparkles-outline',
  //   route: '/(app)/supply-room',
  //   section: 'estoque',
  //   color: '#2563eb',
  //   bg: '#eff6ff',
  // },
  // {
  //   key: 'streetSales',
  //   label: 'Faturamento',
  //   icon: 'storefront-outline',
  //   route: '/(app)/street-sales',
  //   section: 'estoque',
  //   color: '#b45309',
  //   bg: '#fffbeb',
  // },
  // Mensagens e Pedidos escondidos do menu por ora (vão voltar): as rotas
  // continuam no app.
  // {
  //   key: 'messages',
  //   label: 'Mensagens',
  //   icon: 'chatbubbles-outline',
  //   route: '/(app)/messages',
  //   section: 'comunicacao',
  //   color: '#0891b2',
  //   bg: '#ecfeff',
  // },
  // {
  //   key: 'wishlist',
  //   label: 'Pedidos',
  //   icon: 'gift-outline',
  //   route: '/(app)/wishlist',
  //   section: 'comunicacao',
  //   color: '#db2777',
  //   bg: '#fdf2f8',
  // },
  {
    key: 'supportGroups',
    label: 'Grupos de apoio',
    icon: 'heart-circle-outline',
    route: '/(app)/support-groups',
    section: 'comunicacao',
    color: '#e11d48',
    bg: '#fff1f2',
  },
  {
    key: 'sync',
    label: 'Pendências de envio',
    icon: 'cloud-upload-outline',
    route: '/(app)/sync',
    section: 'conta',
    color: '#b45309',
    bg: '#fffbeb',
  },
];

/** Ordem dos atalhos do dashboard — subconjunto do catálogo, não lista paralela. */
export const QUICK_ACTION_KEYS: MenuItemKey[] = [
  'contributions',
  'incidents',
  'activities',
  'residents',
  'ministries',
  // Escondidos por ora junto com os itens do menu (vão voltar).
  // 'storeroom',
  // 'supplyRoom',
  // 'streetSales',
  // 'events',
  'census',
  'houseSettings',
];

/**
 * Única regra de visibilidade do app. `_layout.tsx` (tabs), menu e ações
 * rápidas consultam esta função — nada de recalcular a condição na tela.
 */
export function canAccessMenuItem(key: MenuItemKey, access: MenuAccess): boolean {
  const isHouseStaff = !access.isResident && !access.isSupportGroupServant;

  switch (key) {
    case 'census':
    // Story 225 (decisão 3): Daily só para ADMIN/COORDINATOR da casa.
    case 'daily':
      return isHouseStaff && access.isCoordinator;
    case 'houseSettings':
      return isHouseStaff && access.isHouseCoordinator;
    case 'messages':
      return (
        !access.isSupportGroupServant &&
        (access.isResident || access.canSendMessagesToFamilies || access.canModerateMessages)
      );
    case 'wishlist':
      return !access.isSupportGroupServant && (access.isResident || access.canModerateMessages);
    case 'supportGroups':
      return access.isSupportGroupServant;
    default:
      // Casa, estoque e a fila de envio são do operador dentro da casa: nem
      // interno nem servo de grupo de apoio abrem essas telas.
      return isHouseStaff;
  }
}

/** Rota do item no catálogo — telas fora do menu navegam por aqui, não por string solta. */
export function menuItemRoute(key: MenuItemKey): string {
  return (MENU_ITEMS.find((item) => item.key === key) as AppMenuItem).route;
}

export function buildMenuItems(access: MenuAccess): AppMenuItem[] {
  return MENU_ITEMS.filter((item) => canAccessMenuItem(item.key, access));
}

export interface QuickActionItem {
  key: MenuItemKey;
  label: string;
  icon: IoniconName;
  route: string;
  color: string;
  bg: string;
}

export function buildQuickActions(access: MenuAccess): QuickActionItem[] {
  return QUICK_ACTION_KEYS.filter((key) => canAccessMenuItem(key, access)).map((key) => {
    const item = MENU_ITEMS.find((candidate) => candidate.key === key) as AppMenuItem;
    return {
      key: item.key,
      label: item.quickAction?.label ?? item.label,
      icon: item.icon,
      route: item.quickAction?.route ?? item.route,
      color: item.color,
      bg: item.bg,
    };
  });
}

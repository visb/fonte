import {
  MENU_ITEMS,
  MENU_ITEM_KEYS,
  MENU_SECTIONS,
  QUICK_ACTION_KEYS,
  buildMenuItems,
  buildQuickActions,
  canAccessMenuItem,
  menuItemRoute,
  type MenuAccess,
  type MenuItemKey,
} from './constants';

const BASE: MenuAccess = {
  isResident: false,
  isSupportGroupServant: false,
  isCoordinator: false,
  isHouseCoordinator: false,
  canSendMessagesToFamilies: false,
  canModerateMessages: false,
};

const servant: MenuAccess = { ...BASE };
const coordinator: MenuAccess = { ...BASE, isCoordinator: true };
const houseCoordinator: MenuAccess = {
  ...BASE,
  isCoordinator: true,
  isHouseCoordinator: true,
};
const resident: MenuAccess = { ...BASE, isResident: true };
const supportGroupServant: MenuAccess = { ...BASE, isSupportGroupServant: true };
const messenger: MenuAccess = { ...BASE, canSendMessagesToFamilies: true };
const moderator: MenuAccess = { ...BASE, canModerateMessages: true };

function keysOf(access: MenuAccess): MenuItemKey[] {
  return buildMenuItems(access).map((item) => item.key);
}

describe('catálogo do menu', () => {
  it('tem um item por chave declarada, sem duplicata e com seção válida', () => {
    const sections = MENU_SECTIONS.map((section) => section.key);
    expect(MENU_ITEMS.map((item) => item.key).sort()).toEqual([...MENU_ITEM_KEYS].sort());
    expect(new Set(MENU_ITEMS.map((item) => item.route)).size).toBe(MENU_ITEMS.length);
    MENU_ITEMS.forEach((item) => {
      expect(sections).toContain(item.section);
      expect(item.route.startsWith('/(app)/')).toBe(true);
      expect(item.label.length).toBeGreaterThan(0);
    });
  });

  // Story 221: os cards do dashboard navegam pela rota do catálogo.
  it('menuItemRoute devolve a rota do item', () => {
    expect(menuItemRoute('residents')).toBe('/(app)/residents');
    expect(menuItemRoute('staff')).toBe('/(app)/staff');
  });
});

describe('buildMenuItems por perfil', () => {
  it('servo com casa vê o pacote da casa, sem contagem nem configurações da casa', () => {
    const keys = keysOf(servant);
    expect(keys).toEqual([
      'contributions',
      'residents',
      'staff',
      'incidents',
      'activities',
      'ministries',
      'events',
      'storeroom',
      'supplyRoom',
      'streetSales',
      'sync',
    ]);
    expect(keys).not.toContain('census');
    expect(keys).not.toContain('houseSettings');
    expect(keys).not.toContain('supportGroups');
  });

  it('coordenador ganha a contagem', () => {
    const keys = keysOf(coordinator);
    expect(keys).toContain('census');
    expect(keys).not.toContain('houseSettings');
  });

  it('coordenador da própria casa ganha as configurações da casa', () => {
    const keys = keysOf(houseCoordinator);
    expect(keys).toContain('census');
    expect(keys).toContain('houseSettings');
  });

  it('interno vê só mensagens e pedidos', () => {
    expect(keysOf(resident)).toEqual(['messages', 'wishlist']);
  });

  it('servo de grupo de apoio vê apoio e nenhuma rota de casa ou estoque', () => {
    const keys = keysOf(supportGroupServant);
    expect(keys).toEqual(['supportGroups']);
    expect(keys).not.toContain('residents');
    expect(keys).not.toContain('storeroom');
    expect(keys).not.toContain('sync');
  });

  // Story 204 (decisão 2): mesmo gate de Filhos.
  it('Servos: visível para coordenador e servo; invisível para interno e servo de grupo de apoio', () => {
    expect(keysOf(servant)).toContain('staff');
    expect(keysOf(coordinator)).toContain('staff');
    expect(keysOf(houseCoordinator)).toContain('staff');
    expect(keysOf(resident)).not.toContain('staff');
    expect(keysOf(supportGroupServant)).not.toContain('staff');

    const item = MENU_ITEMS.find((candidate) => candidate.key === 'staff');
    expect(item).toMatchObject({
      label: 'Servos',
      icon: 'id-card-outline',
      route: '/(app)/staff',
      section: 'casa',
    });
    // Logo depois de Filhos e sem ação rápida no dashboard.
    const keys = MENU_ITEMS.map((candidate) => candidate.key);
    expect(keys.indexOf('staff')).toBe(keys.indexOf('residents') + 1);
    expect(QUICK_ACTION_KEYS).not.toContain('staff');
  });

  it('mensagens exige permissão de enviar ou moderar; pedidos exige moderar', () => {
    expect(keysOf(servant)).not.toContain('messages');
    expect(keysOf(servant)).not.toContain('wishlist');

    expect(keysOf(messenger)).toContain('messages');
    expect(keysOf(messenger)).not.toContain('wishlist');

    expect(keysOf(moderator)).toContain('messages');
    expect(keysOf(moderator)).toContain('wishlist');
  });

  it('nenhuma seção do menu fica vazia com título órfão para o servo da casa', () => {
    const items = buildMenuItems(moderator);
    const usedSections = new Set(items.map((item) => item.section));
    expect(usedSections.has('casa')).toBe(true);
    expect(usedSections.has('estoque')).toBe(true);
    expect(usedSections.has('comunicacao')).toBe(true);
    expect(usedSections.has('conta')).toBe(true);
  });
});

/**
 * Trava de paridade (story 176): o catálogo é a fonte única, mas ele nasceu de
 * regras que já existiam espalhadas — os `href` condicionais do
 * `app/(app)/_layout.tsx` e as flags do `DashboardPage`. O oráculo abaixo é a
 * cópia literal daquelas regras: se o catálogo divergir delas, algum perfil
 * ganha item de menu para uma tela que não pode abrir.
 */
describe('paridade com as regras de visibilidade do _layout/dashboard', () => {
  const profiles: { name: string; access: MenuAccess }[] = [
    { name: 'servo', access: servant },
    { name: 'coordenador', access: coordinator },
    { name: 'coordenador da casa', access: houseCoordinator },
    { name: 'interno', access: resident },
    { name: 'servo de grupo de apoio', access: supportGroupServant },
    { name: 'servo com envio de mensagens', access: messenger },
    { name: 'servo moderador', access: moderator },
  ];

  // Regras legadas, escritas exatamente como estavam nas telas.
  function legacyTabVisibility(a: MenuAccess) {
    const isHouseStaff = !a.isResident && !a.isSupportGroupServant;
    return {
      residents: !(a.isSupportGroupServant || a.isResident),
      messages: !(
        a.isSupportGroupServant ||
        (!a.isResident && !a.canSendMessagesToFamilies && !a.canModerateMessages)
      ),
      wishlist: !(a.isSupportGroupServant || (!a.isResident && !a.canModerateMessages)),
      supportGroups: a.isSupportGroupServant,
      // Dashboard só era alcançável por quem tem casa: as flags nasciam lá.
      census: isHouseStaff && a.isCoordinator,
      houseSettings: isHouseStaff && a.isHouseCoordinator,
    };
  }

  profiles.forEach(({ name, access }) => {
    it(`${name}: catálogo concorda com as regras de href e as flags do dashboard`, () => {
      const legacy = legacyTabVisibility(access);
      (Object.keys(legacy) as (keyof ReturnType<typeof legacyTabVisibility>)[]).forEach(
        (key) => {
          expect(canAccessMenuItem(key, access)).toBe(legacy[key]);
        },
      );
    });

    it(`${name}: toda rota visível na tab bar está no catálogo`, () => {
      const legacy = legacyTabVisibility(access);
      const keys = keysOf(access);
      (['residents', 'messages', 'wishlist', 'supportGroups'] as MenuItemKey[]).forEach(
        (key) => {
          const visibleInTabBar = legacy[key as keyof typeof legacy];
          expect(keys.includes(key)).toBe(visibleInTabBar);
        },
      );
    });

    it(`${name}: nenhum atalho do dashboard escapa do que o menu permite`, () => {
      const menuKeys = keysOf(access);
      buildQuickActions(access).forEach((action) => {
        expect(menuKeys).toContain(action.key);
      });
    });
  });
});

describe('buildQuickActions', () => {
  it('mantém os rótulos e as rotas de hoje a partir do catálogo', () => {
    const actions = buildQuickActions(servant);
    expect(actions.map((action) => action.label)).toEqual([
      'Nova contribuição',
      'Nova ocorrência',
      'Atividades',
      'Ver filhos',
      'Ministérios',
      'Dispensa',
      'Almoxarifado',
      'Faturamento',
      'Eventos internos',
    ]);
    expect(actions.find((action) => action.key === 'incidents')?.route).toBe(
      '/(app)/incidents/new',
    );
    expect(actions.find((action) => action.key === 'residents')?.route).toBe(
      '/(app)/residents',
    );
  });

  it('acrescenta contagem e configurações da casa conforme o acesso', () => {
    expect(buildQuickActions(coordinator).map((a) => a.label)).toContain('Contagem');
    expect(buildQuickActions(coordinator).map((a) => a.label)).not.toContain(
      'Configurações da casa',
    );
    expect(buildQuickActions(houseCoordinator).map((a) => a.label)).toContain(
      'Configurações da casa',
    );
  });

  it('não oferece atalho nenhum para interno ou servo de grupo de apoio', () => {
    expect(buildQuickActions(resident)).toEqual([]);
    expect(buildQuickActions(supportGroupServant)).toEqual([]);
  });

  it('só usa chaves que existem no catálogo', () => {
    QUICK_ACTION_KEYS.forEach((key) => {
      expect(MENU_ITEM_KEYS).toContain(key);
    });
  });
});

import {
  MENU_ITEMS,
  MENU_ITEM_KEYS,
  MENU_SECTIONS,
  QUICK_ACTION_KEYS,
  buildMenuItems,
  buildQuickActions,
  canAccessMenuItem,
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
});

describe('buildMenuItems por perfil', () => {
  it('servo com casa vê o pacote da casa, sem contagem nem configurações da casa', () => {
    const keys = keysOf(servant);
    expect(keys).toEqual([
      'contributions',
      'residents',
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
      'Nova declaração',
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

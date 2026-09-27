/**
 * Constantes da infra offline-first do ops.fonte (story 168).
 *
 * O app roda dentro das casas, onde o sinal é ruim ou inexistente: o cache do
 * React Query é persistido em AsyncStorage para que o app **abra com dado**.
 */

/** Chave única do cache persistido do React Query no AsyncStorage. */
export const PERSIST_KEY = 'ops-fonte-query-cache';

/**
 * Buster versionado à mão: incrementar sempre que a **forma** dos dados
 * cacheados mudar (troca de contrato, renomeio de campo, mudança de queryKey).
 * Deploy novo com formato novo descarta o cache antigo em vez de reidratar lixo.
 */
export const PERSIST_BUSTER = 'v2';

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

/**
 * Cache mais velho que 24h é descartado na reidratação: o operador não decide
 * nada com base em contagem de anteontem.
 */
export const PERSIST_MAX_AGE = TWENTY_FOUR_HOURS;

/**
 * `gcTime` alinhado ao `maxAge`. Sem isso a persistência é inútil: com o default
 * de 5 min a query é coletada antes de o cache ser reidratado com utilidade.
 */
export const QUERY_GC_TIME = TWENTY_FOUR_HOURS;

/** Janela mínima entre gravações do cache no AsyncStorage. */
export const PERSIST_THROTTLE_TIME = 1_000;

/**
 * Domínio de filho: sai do blob e passa a viver no **store local** (story 175,
 * `lib/offline/store/`), sem prazo de validade e com purga no logout.
 *
 * Estes prefixos são allowlist do store, não do persister: manter os dois
 * gravando o mesmo dado deixaria a ficha em dois lugares com prazos diferentes
 * — o blob apagaria em 24h o que o store promete guardar até o logout.
 */
export const RESIDENT_STORE_QUERY_PREFIXES = [
  // residents.all / residents.byHouse
  'residents',
  // residents.countByHouse (home)
  'residents-count',
  // residents.detail
  'resident',
  // ficha ampliada (decisão 3 da story 175)
  'resident-follow-ups',
  'resident-attachments',
  'resident-consents',
  'resident-receivables',
  // Fila da casa contém nome de filho: store purgado no logout, nunca blob de 24h.
  'resident-product-contributions-house',
] as const;

/**
 * **Allowlist** (nunca denylist) dos primeiros segmentos de `queryKeys` que
 * podem ir para o disco.
 *
 * Decisão LGPD do epic 167: o cache persistido guarda dado pessoal de filho no
 * dispositivo, então só entra o que os fluxos de campo e a home realmente
 * consomem offline. Tudo que não estiver nesta lista fica **só em memória** —
 * inverter isso para uma denylist vaza dado novo por omissão.
 *
 * Fora da lista de propósito: mensagens, notificações, wishlist, grupos de
 * apoio, curso bíblico, parentes e eventos. O domínio de filho também está
 * fora, mas por outro motivo: ele migrou para o store local da story 175
 * (`RESIDENT_STORE_QUERY_PREFIXES`).
 */
export const PERSISTED_QUERY_PREFIXES = [
  // houses.all
  'houses',
  // houses.ministries — leitura de casa desde a story 197: sem filho como
  // membro nem como líder, a resposta não tem mais nome de filho e a chave
  // deixou de pertencer ao store local (que guarda dado pessoal até o logout).
  'house-ministries',
  // inventory.catalog
  'inventory-catalog',
  // storeroom.items / storeroom.movements
  'storeroom-items',
  'storeroom-movements',
  // supplyRoom.items / supplyRoom.movements
  'supply-room-items',
  'supply-room-movements',
  // incidents.all / incidents.byHouse / incidents.todayByHouse
  'incidents',
  'incidents-today',
  // activities.* (byHouse, detail, comments)
  'activities',
  // streetSales.all / streetSales.byHouse
  'street-sales',
] as const;

/**
 * Só o **primeiro segmento** da chave decide: os `queryKeys` do app usam o
 * primeiro elemento como nome do recurso e os seguintes como identificadores
 * (`['resident', id]`). Comparação por igualdade — não por prefixo de string —
 * para que `resident-attachments` não entre de carona em `resident`.
 */
export function isPersistableQueryKey(queryKey: readonly unknown[]): boolean {
  const resource = queryKey[0];
  if (typeof resource !== 'string') return false;
  return (PERSISTED_QUERY_PREFIXES as readonly string[]).includes(resource);
}

/** Chave cujo dado mora no store local dos filhos (story 175), não no blob. */
export function isResidentStoreQueryKey(queryKey: readonly unknown[]): boolean {
  const resource = queryKey[0];
  if (typeof resource !== 'string') return false;
  return (RESIDENT_STORE_QUERY_PREFIXES as readonly string[]).includes(resource);
}

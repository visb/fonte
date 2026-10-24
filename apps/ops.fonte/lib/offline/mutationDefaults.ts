/**
 * Defaults das mutations de campo (story 169, decisão 1).
 *
 * Toda escrita que pode acontecer sem sinal declara aqui — **fora da árvore
 * React** — a sua `mutationFn`, a invalidação e o update otimista. Motivo: a
 * mutation pausada é persistida sem a função (função não é serializável), então
 * no restart o React Query só consegue retomá-la se achar o default pela
 * `mutationKey`. Hook com `mutationFn` inline = lançamento perdido no restart.
 */
import type { MutationOptions, QueryClient } from '@tanstack/react-query';
import { ActivityStatus, MovementType } from '@fonte/types';
import type { ProductContributionLineInput, ReceivableProductContribution } from '@fonte/types';
import { applyProductContribution, settleProductContribution } from './productContributions';
import { updateCatalogItem, snapshotCatalogNames, resolveContributionLines } from './catalogItems';
import type {
  Activity,
  CensusConcludeInput,
  CreateActivityCommentInput,
  CreateActivityInput,
  CreateIncidentInput,
  CreateItemInput,
  CreateMovementInput,
  CreateResidentInput,
  CreateStreetSaleInput,
  CreateSupplyItemInput,
  CreateSupplyMovementInput,
  Incident,
  Resident,
  StoreroomItem,
  StoreroomMovement,
  StreetSale,
  SupplyRoomItem,
  SupplyRoomMovement,
  UpdateResidentInput,
  UpdateStreetSaleInput,
} from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { buildFormDataFromOutboxFile, discardOutboxFile, persistOutboxFile } from './attachments';
import { forgetLocalId, isLocalId, rememberLocalId, resolveLocalId } from './localIds';
import {
  OUTBOX_MUTATION_KEYS,
  ensureIdempotencyKey,
  outboxEntityId,
  outboxRetry,
  type OutboxMutationKey,
  type OutboxVariables,
} from './outbox';

// ── variáveis por chave ───────────────────────────────────────────────────────
// Tudo que a `mutationFn` e a invalidação precisam vai nas variáveis: é a única
// parte do item que sobrevive à desidratação. Nada de closure.

export interface PickedPhoto {
  uri: string;
  type: string;
}

export interface ProductContributionDeclareVariables extends OutboxVariables {
  residentId: string;
  receivableId: string;
  houseId: string;
  referenceMonth: string;
  lines: ProductContributionLineInput[];
  /** Nome local preservado para a pendência; nunca enviado à API. */
  itemNames?: Record<string, string>;
}

export interface CensusAddResidentVariables extends OutboxVariables {
  houseId: string;
  data: CreateResidentInput;
  photo?: PickedPhoto;
  /** Caminho estável gravado no `onMutate` (decisão 6). */
  photoPath?: string;
}

/** Story 218 — payload mínimo do reacolhimento (decisão 8). */
export interface CensusReadmitResidentVariables extends OutboxVariables {
  houseId: string;
  residentId: string;
  data: { houseId: string; entryDate: string };
  /** Só para a tela de pendências — não vai para o backend. */
  residentName?: string;
}

export interface ResidentUploadPhotoVariables extends OutboxVariables {
  houseId: string;
  residentId: string;
  photoPath: string;
  mimeType?: string;
}

export interface CensusConcludeVariables extends OutboxVariables {
  houseId: string;
  data: CensusConcludeInput;
}

export interface ResidentUpdateStatusVariables extends OutboxVariables {
  houseId: string;
  residentId: string;
  data: UpdateResidentInput;
}

export interface IncidentCreateVariables extends OutboxVariables {
  data: CreateIncidentInput;
  /** Só para o update otimista — não vai para o backend. */
  responsibleName?: string;
  residentName?: string;
}

export interface StoreroomMovementVariables extends OutboxVariables {
  data: CreateMovementInput;
  responsibleName?: string;
}

export interface StoreroomItemVariables extends OutboxVariables {
  data: CreateItemInput;
  /**
   * Id sintético `local:<uuid>` do item criado sem sinal (story 171, decisão 2):
   * é ele que a tela usa para encadear a movimentação enquanto o cadastro não
   * sobe. Ausente quando a tela não precisou encadear nada.
   */
  localId?: string;
}

export interface SupplyMovementVariables extends OutboxVariables {
  data: CreateSupplyMovementInput;
  responsibleName?: string;
}

export interface SupplyItemVariables extends OutboxVariables {
  data: CreateSupplyItemInput;
  /** Ver `StoreroomItemVariables.localId`. */
  localId?: string;
}

export interface StreetSaleCreateVariables extends OutboxVariables {
  data: CreateStreetSaleInput;
}

export interface StreetSaleUpdateVariables extends OutboxVariables {
  id: string;
  houseId: string;
  data: UpdateStreetSaleInput;
}

export interface ActivityCreateVariables extends OutboxVariables {
  data: CreateActivityInput;
}

export interface ActivityCommentVariables extends OutboxVariables {
  activityId: string;
  data: CreateActivityCommentInput;
}

// ── helpers de cache ──────────────────────────────────────────────────────────

function invalidateHouseResidents(queryClient: QueryClient, houseId: string): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.residents.byHouse(houseId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.residents.countByHouse(houseId) });
}

function signedQuantity(type: MovementType, quantity: number): number {
  return type === MovementType.IN ? Number(quantity) : -Number(quantity);
}

/** Aplica o delta do movimento na lista de itens (o estoque muda na hora). */
function shiftItemQuantity<T extends { id: string; currentQuantity: number }>(
  items: T[] | undefined,
  itemId: string,
  delta: number,
): T[] | undefined {
  return items?.map((item) =>
    item.id === itemId
      ? { ...item, currentQuantity: Number(item.currentQuantity) + delta }
      : item,
  );
}

function dropOutboxEntry<T extends { id: string }>(entries: T[] | undefined, id: string): T[] | undefined {
  return entries?.filter((entry) => entry.id !== id);
}

function findCachedItem<T extends { id: string }>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  itemId: string,
): T | undefined {
  for (const [, data] of queryClient.getQueriesData<T[]>({ queryKey })) {
    const found = data?.find((entry) => entry.id === itemId);
    if (found) return found;
  }
  return undefined;
}

// ── updates otimistas (decisão 8) ─────────────────────────────────────────────
// Só os fluxos em que "aparecer na hora" é o ponto: movimentação de estoque e
// ocorrência. A entrada sintética usa id derivado da chave de idempotência, de
// modo que o rollback a encontra sem guardar snapshot no `context` — snapshot
// iria para o disco junto da mutation (dado pessoal duplicado, LGPD do 167).

function applyStoreroomMovement(queryClient: QueryClient, variables: StoreroomMovementVariables): void {
  const { data } = variables;
  const item = findCachedItem<StoreroomItem>(queryClient, queryKeys.storeroom.allItems, data.itemId);
  const delta = signedQuantity(data.type, data.quantity);

  queryClient.setQueriesData<StoreroomItem[]>({ queryKey: queryKeys.storeroom.allItems }, (items) =>
    shiftItemQuantity(items, data.itemId, delta),
  );
  queryClient.setQueriesData<StoreroomMovement[]>(
    { queryKey: queryKeys.storeroom.movements(data.itemId) },
    (movements) => [
      {
        id: outboxEntityId(variables.idempotencyKey ?? ''),
        itemId: data.itemId,
        item: { id: data.itemId, name: item?.name ?? '', unit: item?.unit ?? '' },
        type: data.type,
        quantity: Number(data.quantity),
        responsibleId: data.responsibleId,
        responsible: { id: data.responsibleId, name: variables.responsibleName ?? '' },
        date: data.date,
        notes: data.notes ?? null,
      },
      ...(movements ?? []),
    ],
  );
}

function rollbackStoreroomMovement(queryClient: QueryClient, variables: StoreroomMovementVariables): void {
  const { data } = variables;
  const id = outboxEntityId(variables.idempotencyKey ?? '');

  queryClient.setQueriesData<StoreroomItem[]>({ queryKey: queryKeys.storeroom.allItems }, (items) =>
    shiftItemQuantity(items, data.itemId, -signedQuantity(data.type, data.quantity)),
  );
  queryClient.setQueriesData<StoreroomMovement[]>(
    { queryKey: queryKeys.storeroom.movements(data.itemId) },
    (movements) => dropOutboxEntry(movements, id),
  );
}

function applySupplyMovement(queryClient: QueryClient, variables: SupplyMovementVariables): void {
  const { data } = variables;
  const item = findCachedItem<SupplyRoomItem>(queryClient, queryKeys.supplyRoom.allItems, data.itemId);
  const delta = signedQuantity(data.type, data.quantity);

  queryClient.setQueriesData<SupplyRoomItem[]>({ queryKey: queryKeys.supplyRoom.allItems }, (items) =>
    shiftItemQuantity(items, data.itemId, delta),
  );
  queryClient.setQueriesData<SupplyRoomMovement[]>(
    { queryKey: queryKeys.supplyRoom.movements(data.itemId) },
    (movements) => [
      {
        id: outboxEntityId(variables.idempotencyKey ?? ''),
        itemId: data.itemId,
        item: {
          id: data.itemId,
          name: item?.name ?? '',
          unit: item?.unit ?? '',
          category: item?.category as SupplyRoomItem['category'],
        },
        type: data.type,
        quantity: Number(data.quantity),
        responsibleId: data.responsibleId,
        responsible: { id: data.responsibleId, name: variables.responsibleName ?? '' },
        date: data.date,
        notes: data.notes ?? null,
      },
      ...(movements ?? []),
    ],
  );
}

function rollbackSupplyMovement(queryClient: QueryClient, variables: SupplyMovementVariables): void {
  const { data } = variables;
  const id = outboxEntityId(variables.idempotencyKey ?? '');

  queryClient.setQueriesData<SupplyRoomItem[]>({ queryKey: queryKeys.supplyRoom.allItems }, (items) =>
    shiftItemQuantity(items, data.itemId, -signedQuantity(data.type, data.quantity)),
  );
  queryClient.setQueriesData<SupplyRoomMovement[]>(
    { queryKey: queryKeys.supplyRoom.movements(data.itemId) },
    (movements) => dropOutboxEntry(movements, id),
  );
}

function applyIncident(queryClient: QueryClient, variables: IncidentCreateVariables): void {
  const { data } = variables;
  const optimistic: Incident = {
    id: outboxEntityId(variables.idempotencyKey ?? ''),
    date: data.date,
    severity: data.severity,
    description: data.description,
    houseId: data.houseId,
    responsible: { id: data.responsibleId, name: variables.responsibleName ?? '' },
    resident: data.residentId
      ? { id: data.residentId, name: variables.residentName ?? '' }
      : null,
  };

  queryClient.setQueriesData<Incident[]>({ queryKey: queryKeys.incidents.all }, (incidents) => [
    optimistic,
    ...(incidents ?? []),
  ]);
}

function rollbackIncident(queryClient: QueryClient, variables: IncidentCreateVariables): void {
  const id = outboxEntityId(variables.idempotencyKey ?? '');
  queryClient.setQueriesData<Incident[]>({ queryKey: queryKeys.incidents.all }, (incidents) =>
    dropOutboxEntry(incidents, id),
  );
}

// ── item de estoque criado sem sinal (story 171, decisão 2) ───────────────────
// O item entra na lista com id `local:<uuid>` para poder ser escolhido na
// movimentação seguinte. Quando o cadastro sobe, o mapeamento local → real é
// gravado e a movimentação da fila resolve o id no envio.

function applyLocalStoreroomItem(queryClient: QueryClient, variables: StoreroomItemVariables): void {
  if (!isLocalId(variables.localId)) return;
  const { data } = variables;
  updateCatalogItem(queryClient, variables, 'storeroom', { ...data, id: variables.localId! });

  queryClient.setQueryData<StoreroomItem[]>(queryKeys.storeroom.items(data.houseId), (items) => [
    ...(items ?? []).filter((item) => item.id !== variables.localId),
    {
      id: variables.localId!,
      name: data.name,
      unit: data.unit,
      houseId: data.houseId,
      currentQuantity: 0,
      weeklyAverageUsage: null,
      weeklyAverageCalculatedAt: null,
      weeklyAverageWindowStart: null,
      weeklyAverageWindowEnd: null,
    },
  ]);
}

function applyLocalSupplyItem(queryClient: QueryClient, variables: SupplyItemVariables): void {
  if (!isLocalId(variables.localId)) return;
  const { data } = variables;
  updateCatalogItem(queryClient, variables, 'supply', { ...data, id: variables.localId! });

  queryClient.setQueryData<SupplyRoomItem[]>(queryKeys.supplyRoom.items(data.houseId), (items) => [
    ...(items ?? []).filter((item) => item.id !== variables.localId),
    {
      id: variables.localId!,
      name: data.name,
      unit: data.unit,
      category: data.category,
      houseId: data.houseId,
      currentQuantity: 0,
    },
  ]);
}

/**
 * Cadastro recusado pelo servidor: o item local sai da lista e o mapeamento é
 * descartado. A movimentação que apontava para ele falha com motivo próprio
 * (`UnresolvedLocalIdError`) e aparece em "Não enviadas" — nunca em silêncio.
 */
function rollbackLocalItem<T extends { id: string }>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  localId: string | undefined,
): void {
  if (!isLocalId(localId)) return;
  queryClient.setQueriesData<T[]>({ queryKey }, (items) => dropOutboxEntry(items, localId));
  void forgetLocalId(localId);
}

// ── venda de rua e atividade (decisão 5) ──────────────────────────────────────
// Lançados fora da casa/no pátio: precisam aparecer na lista na hora, com selo
// de pendente, senão o operador lança de novo achando que não salvou.

function applyStreetSale(queryClient: QueryClient, variables: StreetSaleCreateVariables): void {
  const { data } = variables;
  const optimistic: StreetSale = {
    id: outboxEntityId(variables.idempotencyKey ?? ''),
    houseId: data.houseId,
    // Nome da casa e autor não são exibidos na lista do ops; a verdade chega
    // com a invalidação depois do envio.
    houseName: '',
    registeredById: '',
    date: data.date,
    type: data.type,
    quantity: Number(data.quantity),
    amountPix: Number(data.amountPix),
    amountCash: Number(data.amountCash),
    amountCard: Number(data.amountCard),
    totalAmount: Number(data.amountPix) + Number(data.amountCash) + Number(data.amountCard),
    createdAt: new Date().toISOString(),
  };

  queryClient.setQueriesData<StreetSale[]>(
    { queryKey: queryKeys.streetSales.byHouse(data.houseId) },
    (sales) => [optimistic, ...(sales ?? [])],
  );
}

function rollbackStreetSale(queryClient: QueryClient, variables: StreetSaleCreateVariables): void {
  const id = outboxEntityId(variables.idempotencyKey ?? '');
  queryClient.setQueriesData<StreetSale[]>(
    { queryKey: queryKeys.streetSales.byHouse(variables.data.houseId) },
    (sales) => dropOutboxEntry(sales, id),
  );
}

function applyActivity(queryClient: QueryClient, variables: ActivityCreateVariables): void {
  const { data } = variables;
  if (!data.houseId) return;

  const now = new Date().toISOString();
  const optimistic: Activity = {
    id: outboxEntityId(variables.idempotencyKey ?? ''),
    title: data.title,
    description: data.description ?? null,
    // O ops cria sempre como rascunho; o backend aplica o mesmo default.
    status: data.status ?? ActivityStatus.DRAFT,
    houseId: data.houseId,
    house: null,
    responsibleStaffId: data.responsibleStaffId ?? null,
    responsible: null,
    createdByUserId: '',
    createdBy: null,
    createdAt: now,
    updatedAt: now,
  };

  // Chave exata: `activities.all` é prefixo de `detail`/`comments`, que guardam
  // outra forma de dado — casar por prefixo corromperia essas listas.
  queryClient.setQueriesData<Activity[]>(
    { queryKey: queryKeys.activities.byHouse(data.houseId), exact: true },
    (activities) => [optimistic, ...(activities ?? [])],
  );
}

function rollbackActivity(queryClient: QueryClient, variables: ActivityCreateVariables): void {
  if (!variables.data.houseId) return;
  const id = outboxEntityId(variables.idempotencyKey ?? '');
  queryClient.setQueriesData<Activity[]>(
    { queryKey: queryKeys.activities.byHouse(variables.data.houseId), exact: true },
    (activities) => dropOutboxEntry(activities, id),
  );
}

// ── catálogo de defaults ──────────────────────────────────────────────────────

interface OutboxDefinition<TVariables extends OutboxVariables, TData> {
  key: OutboxMutationKey;
  /** Envio propriamente dito. A chave de idempotência já está nas variáveis. */
  run: (variables: TVariables) => Promise<TData>;
  /** Preparo assíncrono antes de enfileirar (ex.: copiar a foto escolhida). */
  prepare?: (variables: TVariables) => Promise<void>;
  optimistic?: (queryClient: QueryClient, variables: TVariables) => void;
  rollback?: (queryClient: QueryClient, variables: TVariables) => void;
  /**
   * Pode ser assíncrono: o React Query espera o `onSuccess` terminar antes de
   * liberar o próximo item do mesmo escopo, e é disso que depende o mapeamento
   * do id local ficar pronto antes da movimentação que o usa (story 171).
   */
  settled: (queryClient: QueryClient, variables: TVariables, data?: TData) => void | Promise<void>;
}

type AnyMutationOptions = MutationOptions<unknown, unknown, unknown, unknown>;

export interface RegisterMutationDefaultsOptions {
  /** Override para testes: a política real repete rede para sempre. */
  retry?: AnyMutationOptions['retry'];
  retryDelay?: AnyMutationOptions['retryDelay'];
}

function defineOutboxMutation<TVariables extends OutboxVariables, TData>(
  queryClient: QueryClient,
  definition: OutboxDefinition<TVariables, TData>,
  options: RegisterMutationDefaultsOptions,
): void {
  queryClient.setMutationDefaults<TData, unknown, TVariables, unknown>(definition.key, {
    // Offline a primeira tentativa sai mesmo assim (o NetInfo erra para menos em
    // rede de casa); falhando por rede, o item **pausa** em vez de morrer.
    networkMode: 'offlineFirst',
    // Escopo por recurso = replay **serial e em ordem** dentro do recurso. É o
    // que garante que o cadastro do item suba antes da movimentação que o
    // referencia (story 171, decisão 2) e o filho antes da foto dele.
    // Catálogo e declaração compartilham dependências: o id real precisa estar
    // persistido antes de sair uma declaração que referencia o produto local.
    scope: { id: ['storeroom', 'supplyRoom', 'productContributions'].includes(definition.key[0])
      ? 'inventory' : definition.key[0] },
    retry: options.retry ?? outboxRetry,
    ...(options.retryDelay === undefined ? {} : { retryDelay: options.retryDelay }),
    mutationFn: (variables) => definition.run(variables),
    onMutate: async (variables) => {
      // Uma chave por item, gerada aqui e reusada em todo reenvio (decisão 9).
      ensureIdempotencyKey(variables);
      await definition.prepare?.(variables);
      definition.optimistic?.(queryClient, variables);
      // Sem `context`: ele é desidratado junto da mutation, e snapshot de cache
      // no disco seria dado pessoal duplicado. O rollback usa só as variáveis.
      return undefined;
    },
    onSuccess: (data, variables) => definition.settled(queryClient, variables, data),
    onError: (_error, variables) => {
      // Chegar aqui significa que o React Query desistiu do item (4xx definitivo
      // ou transitório esgotado) — e a dead-letter já o registrou. A tela não
      // pode ficar com o lançamento fantasma.
      definition.rollback?.(queryClient, variables);
      definition.settled(queryClient, variables);
    },
  });
}

/**
 * Enfileira uma mutation da outbox fora da árvore React — usado no
 * encadeamento do censo (decisão 7): o upload da foto só existe depois de o
 * filho ser criado e ter id.
 */
export function enqueueOutboxMutation<TVariables extends OutboxVariables>(
  queryClient: QueryClient,
  mutationKey: OutboxMutationKey,
  variables: TVariables,
): void {
  const defaults = queryClient.getMutationDefaults(mutationKey);
  const mutation = queryClient
    .getMutationCache()
    .build<unknown, unknown, TVariables, unknown>(queryClient, {
      ...(defaults as MutationOptions<unknown, unknown, TVariables, unknown>),
      mutationKey,
    });
  // Falha é tratada pelo `MutationCache.onError` (dead-letter): aqui só evita
  // rejeição não capturada.
  void mutation.execute(variables).catch(() => undefined);
}

/**
 * Registra todos os defaults. Chamado no boot, **antes** da reidratação do
 * cache — mutation reidratada sem default não tem como ser retomada.
 */
export function registerMutationDefaults(
  queryClient: QueryClient,
  options: RegisterMutationDefaultsOptions = {},
): void {
  defineOutboxMutation<ProductContributionDeclareVariables, ReceivableProductContribution[]>(queryClient, {
    key: OUTBOX_MUTATION_KEYS.productContributionDeclare,
    prepare: async (variables) => {
      snapshotCatalogNames(queryClient, variables);
      await queryClient.cancelQueries({ queryKey: queryKeys.houses.productContributions(variables.houseId, variables.referenceMonth) });
    },
    run: async (variables) => api.residents.declareProductContributions(
      variables.residentId, variables.receivableId, { lines: await resolveContributionLines(variables, queryClient) },
      { idempotencyKey: variables.idempotencyKey },
    ),
    optimistic: applyProductContribution,
    settled: (client, variables, data) => {
      settleProductContribution(client, variables, data);
      void client.invalidateQueries({ queryKey: queryKeys.residents.productContributions(variables.residentId, variables.receivableId) });
      void client.invalidateQueries({ queryKey: queryKeys.residents.receivables(variables.residentId) });
      void client.invalidateQueries({ queryKey: queryKeys.residents.detail(variables.residentId) });
      void client.invalidateQueries({ queryKey: queryKeys.houses.productContributions(variables.houseId, variables.referenceMonth) });
    },
  }, options);
  defineOutboxMutation<CensusAddResidentVariables, Resident>(
    queryClient,
    {
      key: OUTBOX_MUTATION_KEYS.censusAddResident,
      prepare: async (variables) => {
        if (!variables.photo || variables.photoPath) return;
        // O URI do picker é temporário: o que entra na fila é a cópia.
        variables.photoPath = await persistOutboxFile(variables.photo.uri);
      },
      run: (variables) =>
        api.census.addResident(variables.data, { idempotencyKey: variables.idempotencyKey }),
      settled: (client, variables, resident) => {
        invalidateHouseResidents(client, variables.houseId);
        if (!resident || !variables.photoPath) return;
        // Segunda etapa: o FormData não pode depender de um id que ainda não existia.
        enqueueOutboxMutation<ResidentUploadPhotoVariables>(
          client,
          OUTBOX_MUTATION_KEYS.residentUploadPhoto,
          {
            houseId: variables.houseId,
            residentId: resident.id,
            photoPath: variables.photoPath,
            mimeType: variables.photo?.type,
          },
        );
      },
    },
    options,
  );

  // Story 218: reacolhe na casa da contagem. Mesmo escopo `census` do cadastro
  // novo — a fila sobe os dois em ordem.
  defineOutboxMutation<CensusReadmitResidentVariables, Resident>(
    queryClient,
    {
      key: OUTBOX_MUTATION_KEYS.censusReadmitResident,
      run: (variables) =>
        api.residents.readmit(variables.residentId, variables.data, {
          idempotencyKey: variables.idempotencyKey,
        }),
      settled: (client, variables) => {
        invalidateHouseResidents(client, variables.houseId);
        void client.invalidateQueries({ queryKey: queryKeys.residents.detail(variables.residentId) });
        void client.invalidateQueries({ queryKey: queryKeys.residentLookup.all });
      },
    },
    options,
  );

  defineOutboxMutation<ResidentUploadPhotoVariables, unknown>(
    queryClient,
    {
      key: OUTBOX_MUTATION_KEYS.residentUploadPhoto,
      run: async (variables) => {
        const formData = await buildFormDataFromOutboxFile(variables.photoPath, {
          type: variables.mimeType,
        });
        return api.residents.uploadPhoto(
          variables.residentId,
          formData as unknown as globalThis.FormData,
        );
      },
      settled: (client, variables) => {
        // Item saiu da fila (enviado ou descartado): o arquivo copiado é lixo.
        void discardOutboxFile(variables.photoPath);
        void client.invalidateQueries({ queryKey: queryKeys.residents.detail(variables.residentId) });
        invalidateHouseResidents(client, variables.houseId);
      },
    },
    options,
  );

  defineOutboxMutation<CensusConcludeVariables, unknown>(
    queryClient,
    {
      key: OUTBOX_MUTATION_KEYS.censusConclude,
      run: (variables) =>
        api.census.conclude(variables.data, { idempotencyKey: variables.idempotencyKey }),
      settled: (client, variables) => invalidateHouseResidents(client, variables.houseId),
    },
    options,
  );

  defineOutboxMutation<ResidentUpdateStatusVariables, unknown>(
    queryClient,
    {
      key: OUTBOX_MUTATION_KEYS.residentUpdateStatus,
      run: (variables) =>
        api.residents.update(variables.residentId, variables.data, {
          idempotencyKey: variables.idempotencyKey,
        }),
      settled: (client, variables) => invalidateHouseResidents(client, variables.houseId),
    },
    options,
  );

  defineOutboxMutation<IncidentCreateVariables, unknown>(
    queryClient,
    {
      key: OUTBOX_MUTATION_KEYS.incidentCreate,
      run: (variables) =>
        api.incidents.create(variables.data, { idempotencyKey: variables.idempotencyKey }),
      optimistic: applyIncident,
      rollback: rollbackIncident,
      settled: (client) => {
        void client.invalidateQueries({ queryKey: queryKeys.incidents.all });
      },
    },
    options,
  );

  defineOutboxMutation<StoreroomMovementVariables, unknown>(
    queryClient,
    {
      key: OUTBOX_MUTATION_KEYS.storeroomCreateMovement,
      run: async (variables) =>
        api.storeroom.createMovement(
          // Item criado offline: o backend só conhece o id real (story 171).
          { ...variables.data, itemId: await resolveLocalId(variables.data.itemId) },
          { idempotencyKey: variables.idempotencyKey },
        ),
      optimistic: applyStoreroomMovement,
      rollback: rollbackStoreroomMovement,
      settled: (client) => {
        void client.invalidateQueries({ queryKey: queryKeys.storeroom.allItems });
        void client.invalidateQueries({ queryKey: queryKeys.storeroom.allMovements });
      },
    },
    options,
  );

  defineOutboxMutation<StoreroomItemVariables, StoreroomItem>(
    queryClient,
    {
      key: OUTBOX_MUTATION_KEYS.storeroomCreateItem,
      run: (variables) =>
        api.storeroom.createItem(variables.data, { idempotencyKey: variables.idempotencyKey }),
      optimistic: applyLocalStoreroomItem,
      rollback: (client, variables) =>
        rollbackLocalItem<StoreroomItem>(client, queryKeys.storeroom.allItems, variables.localId),
      settled: async (client, variables, item) => {
        // Antes de invalidar: a movimentação que espera este item resolve o id
        // pelo mapa, e o próximo item do escopo já pode estar pronto para sair.
        if (item?.id && variables.localId) await rememberLocalId(variables.localId, item.id);
        updateCatalogItem(client, variables, 'storeroom', item);
        void client.invalidateQueries({ queryKey: queryKeys.storeroom.allItems });
      },
    },
    options,
  );

  defineOutboxMutation<SupplyMovementVariables, unknown>(
    queryClient,
    {
      key: OUTBOX_MUTATION_KEYS.supplyRoomCreateMovement,
      run: async (variables) =>
        api.supplyRoom.createMovement(
          { ...variables.data, itemId: await resolveLocalId(variables.data.itemId) },
          { idempotencyKey: variables.idempotencyKey },
        ),
      optimistic: applySupplyMovement,
      rollback: rollbackSupplyMovement,
      settled: (client) => {
        void client.invalidateQueries({ queryKey: queryKeys.supplyRoom.allItems });
        void client.invalidateQueries({ queryKey: queryKeys.supplyRoom.allMovements });
      },
    },
    options,
  );

  defineOutboxMutation<SupplyItemVariables, SupplyRoomItem>(
    queryClient,
    {
      key: OUTBOX_MUTATION_KEYS.supplyRoomCreateItem,
      run: (variables) =>
        api.supplyRoom.createItem(variables.data, { idempotencyKey: variables.idempotencyKey }),
      optimistic: applyLocalSupplyItem,
      rollback: (client, variables) =>
        rollbackLocalItem<SupplyRoomItem>(client, queryKeys.supplyRoom.allItems, variables.localId),
      settled: async (client, variables, item) => {
        if (item?.id && variables.localId) await rememberLocalId(variables.localId, item.id);
        updateCatalogItem(client, variables, 'supply', item);
        void client.invalidateQueries({ queryKey: queryKeys.supplyRoom.allItems });
      },
    },
    options,
  );

  defineOutboxMutation<StreetSaleCreateVariables, unknown>(
    queryClient,
    {
      key: OUTBOX_MUTATION_KEYS.streetSaleCreate,
      run: (variables) =>
        api.streetSales.create(variables.data, { idempotencyKey: variables.idempotencyKey }),
      optimistic: applyStreetSale,
      rollback: rollbackStreetSale,
      settled: (client, variables) => {
        void client.invalidateQueries({
          queryKey: queryKeys.streetSales.byHouse(variables.data.houseId),
        });
      },
    },
    options,
  );

  defineOutboxMutation<StreetSaleUpdateVariables, unknown>(
    queryClient,
    {
      key: OUTBOX_MUTATION_KEYS.streetSaleUpdate,
      run: (variables) =>
        api.streetSales.update(variables.id, variables.data, {
          idempotencyKey: variables.idempotencyKey,
        }),
      settled: (client, variables) => {
        void client.invalidateQueries({
          queryKey: queryKeys.streetSales.byHouse(variables.houseId),
        });
      },
    },
    options,
  );

  defineOutboxMutation<ActivityCreateVariables, unknown>(
    queryClient,
    {
      key: OUTBOX_MUTATION_KEYS.activityCreate,
      run: (variables) =>
        api.activities.create(variables.data, { idempotencyKey: variables.idempotencyKey }),
      optimistic: applyActivity,
      rollback: rollbackActivity,
      settled: (client) => {
        void client.invalidateQueries({ queryKey: queryKeys.activities.all });
      },
    },
    options,
  );

  defineOutboxMutation<ActivityCommentVariables, unknown>(
    queryClient,
    {
      key: OUTBOX_MUTATION_KEYS.activityComment,
      run: (variables) =>
        api.activities.addComment(variables.activityId, variables.data, {
          idempotencyKey: variables.idempotencyKey,
        }),
      settled: (client, variables) => {
        void client.invalidateQueries({
          queryKey: queryKeys.activities.comments(variables.activityId),
        });
      },
    },
    options,
  );
}

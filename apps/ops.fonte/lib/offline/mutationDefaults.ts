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
import { MovementType } from '@fonte/types';
import type {
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
  SupplyRoomItem,
  SupplyRoomMovement,
  UpdateResidentInput,
  UpdateStreetSaleInput,
} from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { buildFormDataFromOutboxFile, discardOutboxFile, persistOutboxFile } from './attachments';
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

export interface CensusAddResidentVariables extends OutboxVariables {
  houseId: string;
  data: CreateResidentInput;
  photo?: PickedPhoto;
  /** Caminho estável gravado no `onMutate` (decisão 6). */
  photoPath?: string;
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
}

export interface SupplyMovementVariables extends OutboxVariables {
  data: CreateSupplyMovementInput;
  responsibleName?: string;
}

export interface SupplyItemVariables extends OutboxVariables {
  data: CreateSupplyItemInput;
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
  queryClient.setQueriesData<Incident[]>(
    { queryKey: queryKeys.incidents.todayByHouse(data.houseId) },
    (incidents) => [optimistic, ...(incidents ?? [])],
  );
}

function rollbackIncident(queryClient: QueryClient, variables: IncidentCreateVariables): void {
  const id = outboxEntityId(variables.idempotencyKey ?? '');
  queryClient.setQueriesData<Incident[]>({ queryKey: queryKeys.incidents.all }, (incidents) =>
    dropOutboxEntry(incidents, id),
  );
  queryClient.setQueriesData<Incident[]>(
    { queryKey: queryKeys.incidents.todayByHouse(variables.data.houseId) },
    (incidents) => dropOutboxEntry(incidents, id),
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
  settled: (queryClient: QueryClient, variables: TVariables, data?: TData) => void;
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
      settled: (client, variables) => {
        void client.invalidateQueries({ queryKey: queryKeys.incidents.all });
        void client.invalidateQueries({
          queryKey: queryKeys.incidents.todayByHouse(variables.data.houseId),
        });
      },
    },
    options,
  );

  defineOutboxMutation<StoreroomMovementVariables, unknown>(
    queryClient,
    {
      key: OUTBOX_MUTATION_KEYS.storeroomCreateMovement,
      run: (variables) =>
        api.storeroom.createMovement(variables.data, {
          idempotencyKey: variables.idempotencyKey,
        }),
      optimistic: applyStoreroomMovement,
      rollback: rollbackStoreroomMovement,
      settled: (client) => {
        void client.invalidateQueries({ queryKey: queryKeys.storeroom.allItems });
        void client.invalidateQueries({ queryKey: queryKeys.storeroom.allMovements });
      },
    },
    options,
  );

  defineOutboxMutation<StoreroomItemVariables, unknown>(
    queryClient,
    {
      key: OUTBOX_MUTATION_KEYS.storeroomCreateItem,
      run: (variables) =>
        api.storeroom.createItem(variables.data, { idempotencyKey: variables.idempotencyKey }),
      settled: (client) => {
        void client.invalidateQueries({ queryKey: queryKeys.storeroom.allItems });
      },
    },
    options,
  );

  defineOutboxMutation<SupplyMovementVariables, unknown>(
    queryClient,
    {
      key: OUTBOX_MUTATION_KEYS.supplyRoomCreateMovement,
      run: (variables) =>
        api.supplyRoom.createMovement(variables.data, {
          idempotencyKey: variables.idempotencyKey,
        }),
      optimistic: applySupplyMovement,
      rollback: rollbackSupplyMovement,
      settled: (client) => {
        void client.invalidateQueries({ queryKey: queryKeys.supplyRoom.allItems });
        void client.invalidateQueries({ queryKey: queryKeys.supplyRoom.allMovements });
      },
    },
    options,
  );

  defineOutboxMutation<SupplyItemVariables, unknown>(
    queryClient,
    {
      key: OUTBOX_MUTATION_KEYS.supplyRoomCreateItem,
      run: (variables) =>
        api.supplyRoom.createItem(variables.data, { idempotencyKey: variables.idempotencyKey }),
      settled: (client) => {
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

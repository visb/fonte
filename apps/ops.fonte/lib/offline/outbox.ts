/**
 * Motor da outbox do ops.fonte (story 169).
 *
 * O operador lança em campo sem sinal e o lançamento **não pode se perder**. O
 * React Query já pausa e retoma mutations; o que falta é (a) um catálogo fechado
 * das chaves de escrita de campo, (b) a classificação de falha (rede ≠ rejeição)
 * e (c) a ponte para a dead-letter quando o React Query desiste do item.
 *
 * Este arquivo é só o motor: quem registra `mutationFn`/invalidação por chave é
 * `mutationDefaults.ts`, e quem mostra a fila para o operador é a story 170.
 */
import { useEffect, useRef, useState } from 'react';
import {
  onlineManager,
  useMutation,
  useQueryClient,
  type MutateOptions,
  type MutationKey,
  type QueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { getErrorMessage } from '@/lib/errors';
import { appendDeadLetter } from './deadLetter';

/** Chave de mutation da outbox: sempre `[recurso, ação]`. */
export type OutboxMutationKey = readonly [string, string];

/**
 * Catálogo **fechado** das escritas que podem ser feitas offline (decisão 1 do
 * epic 167: censo, ocorrências, despensa, almoxarifado, venda de rua e
 * atividades). Chave nova sem default registrado é a falha silenciosa clássica
 * aqui — por isso o catálogo é a fonte única, e o teste de catálogo cobre todas.
 */
export const OUTBOX_MUTATION_KEYS = {
  censusAddResident: ['census', 'addResident'],
  censusConclude: ['census', 'conclude'],
  /** Segunda etapa encadeada do `censusAddResident` (decisão 7): precisa do id criado. */
  residentUploadPhoto: ['residents', 'uploadPhoto'],
  residentUpdateStatus: ['residents', 'updateStatus'],
  incidentCreate: ['incidents', 'create'],
  storeroomCreateMovement: ['storeroom', 'createMovement'],
  storeroomCreateItem: ['storeroom', 'createItem'],
  supplyRoomCreateMovement: ['supplyRoom', 'createMovement'],
  supplyRoomCreateItem: ['supplyRoom', 'createItem'],
  streetSaleCreate: ['streetSales', 'create'],
  streetSaleUpdate: ['streetSales', 'update'],
  activityCreate: ['activities', 'create'],
  activityComment: ['activities', 'comment'],
} as const satisfies Record<string, OutboxMutationKey>;

export const OUTBOX_MUTATION_KEY_LIST: readonly OutboxMutationKey[] =
  Object.values(OUTBOX_MUTATION_KEYS);

/**
 * Rótulo humano por chave — usado na dead-letter e na tela de pendências (170).
 *
 * Atenção ao nome interno: `storeroom` é a **Dispensa** e `supplyRoom` é o
 * **Almoxarifado** na UI (ver os `_layout.tsx` das rotas). O rótulo segue o que
 * o operador vê na tela, não o nome do módulo.
 */
const OUTBOX_LABELS: Record<string, string> = {
  'census/addResident': 'Filho adicionado na contagem',
  'census/conclude': 'Conclusão da contagem',
  'residents/uploadPhoto': 'Foto do filho',
  'residents/updateStatus': 'Mudança de situação do filho',
  'incidents/create': 'Ocorrência',
  'storeroom/createMovement': 'Movimentação da dispensa',
  'storeroom/createItem': 'Novo item da dispensa',
  'supplyRoom/createMovement': 'Movimentação do almoxarifado',
  'supplyRoom/createItem': 'Novo item do almoxarifado',
  'streetSales/create': 'Venda de rua',
  'streetSales/update': 'Edição de venda de rua',
  'activities/create': 'Atividade',
  'activities/comment': 'Comentário em atividade',
};

/** Forma serializada da chave (`['storeroom','createMovement']` → `storeroom/createMovement`). */
export function serializeMutationKey(mutationKey: MutationKey | undefined): string {
  if (!mutationKey) return '';
  return mutationKey.map((part) => String(part)).join('/');
}

export function isOutboxMutationKey(mutationKey: MutationKey | undefined): boolean {
  const serialized = serializeMutationKey(mutationKey);
  return OUTBOX_MUTATION_KEY_LIST.some((key) => serializeMutationKey(key) === serialized);
}

export function outboxLabel(mutationKey: MutationKey | undefined): string {
  return OUTBOX_LABELS[serializeMutationKey(mutationKey)] ?? 'Lançamento pendente';
}

// ── idempotência (decisão 9, contrato da story 172) ───────────────────────────

/** Variáveis de qualquer item da outbox: sempre carregam a chave de idempotência. */
export interface OutboxVariables {
  /**
   * Header `Idempotency-Key` da story 172. Vive **nas variáveis** (não no
   * `context` do React Query) porque a `mutationFn` só recebe variáveis — e é
   * ela quem precisa reusar a mesma chave em todo reenvio do mesmo item.
   */
  idempotencyKey?: string;
}

/**
 * UUID v4. O Hermes (RN) não tem WebCrypto, e o backend rejeita com 400 chave
 * fora do formato UUID (`IdempotencyInterceptor`), então há fallback próprio.
 * Aleatoriedade fraca não é problema aqui: a chave só precisa ser única por
 * lançamento, não imprevisível.
 */
export function createIdempotencyKey(): string {
  const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof webCrypto?.randomUUID === 'function') return webCrypto.randomUUID();

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random % 4) + 8;
    return value.toString(16);
  });
}

/**
 * Garante a chave **uma vez** por item, gravando no próprio objeto de
 * variáveis: é o que é desidratado junto da mutation pausada, então o reenvio
 * depois do restart usa a mesma chave e o backend devolve a resposta original
 * em vez de duplicar o lançamento.
 */
export function ensureIdempotencyKey(variables: OutboxVariables): string {
  if (!variables.idempotencyKey) variables.idempotencyKey = createIdempotencyKey();
  return variables.idempotencyKey;
}

/** Prefixo dos ids sintéticos criados pelo update otimista (decisão 8). */
export const OUTBOX_ENTITY_ID_PREFIX = 'outbox:';

/**
 * Id derivado da chave de idempotência: o rollback precisa achar a entrada
 * otimista no cache sem guardar snapshot nenhum no `context` (snapshot iria
 * para o disco junto da mutation — dado pessoal duplicado, decisão LGPD do 167).
 */
export function outboxEntityId(idempotencyKey: string): string {
  return `${OUTBOX_ENTITY_ID_PREFIX}${idempotencyKey}`;
}

export function isOutboxEntityId(id: string | undefined | null): boolean {
  return typeof id === 'string' && id.startsWith(OUTBOX_ENTITY_ID_PREFIX);
}

// ── classificação de falha (decisão 4) ────────────────────────────────────────

interface HttpErrorLike {
  response?: { status?: number };
}

function errorStatus(error: unknown): number | undefined {
  return (error as HttpErrorLike | null)?.response?.status;
}

/** Sem `response` não houve resposta do servidor: rede/timeout, não rejeição. */
export function isNetworkError(error: unknown): boolean {
  return errorStatus(error) === undefined;
}

/**
 * Rejeição do servidor que **não** adianta reenviar sozinha: regra de negócio,
 * validação ou permissão (4xx). Timeout (408) e rate limit (429) são
 * transitórios; 5xx também. Sem resposta = rede, nunca definitivo.
 */
export function isDefinitiveFailure(error: unknown): boolean {
  const status = errorStatus(error);
  if (status === undefined) return false;
  if (status === 408 || status === 429) return false;
  return status >= 400 && status < 500;
}

/**
 * `retry` das mutations da outbox: rejeição definitiva não repete; falta de rede
 * repete para sempre (o React Query pausa entre as tentativas enquanto o
 * `onlineManager` estiver offline); 5xx repete com limite para não girar eterno.
 */
export const MAX_SERVER_ERROR_RETRIES = 3;

export function outboxRetry(failureCount: number, error: unknown): boolean {
  if (isDefinitiveFailure(error)) return false;
  if (isNetworkError(error)) return true;
  return failureCount < MAX_SERVER_ERROR_RETRIES;
}

// ── dead-letter (decisão 5) ───────────────────────────────────────────────────

/**
 * Recorte estrutural da `Mutation`: o `MutationCache` e o `getAll()` a tipam com
 * genéricos diferentes, e nada aqui depende do tipo do dado/erro.
 */
export interface OutboxMutationLike {
  options: { mutationKey?: MutationKey };
  state: { variables?: unknown };
}

/**
 * Ponte `MutationCache.onError` → dead-letter. Chegar aqui significa que o
 * React Query **desistiu** do item (4xx definitivo ou transitório esgotado) e o
 * vai descartar do cache: sem gravar agora, o lançamento sumiria da tela e da
 * vida. Por isso registra todo erro final de chave da outbox, não só o 4xx.
 */
export async function recordOutboxFailure(
  error: unknown,
  mutation: OutboxMutationLike,
): Promise<void> {
  const mutationKey = mutation.options.mutationKey;
  if (!isOutboxMutationKey(mutationKey)) return;

  const variables = (mutation.state.variables ?? {}) as OutboxVariables;
  await appendDeadLetter({
    id: variables.idempotencyKey ?? createIdempotencyKey(),
    mutationKey: serializeMutationKey(mutationKey),
    label: outboxLabel(mutationKey),
    variables: mutation.state.variables,
    error: getErrorMessage(error, 'Falha ao sincronizar o lançamento.'),
    failedAt: Date.now(),
  });
}

// ── replay ────────────────────────────────────────────────────────────────────

/**
 * Retoma a fila quando a rede volta. O outro gatilho é a reidratação do cache
 * (`onSuccess` do `PersistQueryClientProvider`), no boot do app.
 */
export function startOutboxReplay(queryClient: QueryClient): () => void {
  return onlineManager.subscribe((isOnline) => {
    if (isOnline) void queryClient.resumePausedMutations();
  });
}

// ── leitura da fila ───────────────────────────────────────────────────────────

export interface PendingOutboxItem {
  /** `mutationId` do React Query — estável enquanto o item está na fila. */
  id: number;
  mutationKey: string;
  label: string;
  variables: unknown;
  /** true = esperando rede; false = tentando agora. */
  isPaused: boolean;
  submittedAt: number;
  failureCount: number;
}

interface PendingMutationLike extends OutboxMutationLike {
  mutationId: number;
  state: {
    variables?: unknown;
    isPaused: boolean;
    submittedAt: number;
    failureCount: number;
    status: string;
  };
}

function toPendingItem(mutation: PendingMutationLike): PendingOutboxItem {
  return {
    id: mutation.mutationId,
    mutationKey: serializeMutationKey(mutation.options.mutationKey),
    label: outboxLabel(mutation.options.mutationKey),
    variables: mutation.state.variables,
    isPaused: mutation.state.isPaused,
    submittedAt: mutation.state.submittedAt,
    failureCount: mutation.state.failureCount,
  };
}

/**
 * Itens da outbox ainda em voo (pausados por falta de rede ou tentando agora),
 * em ordem de entrada — FIFO, como o replay (decisão 3).
 */
export function listPendingMutations(queryClient: QueryClient): PendingOutboxItem[] {
  return queryClient
    .getMutationCache()
    .getAll()
    .filter(
      (mutation) =>
        isOutboxMutationKey(mutation.options.mutationKey) && mutation.state.status === 'pending',
    )
    .map(toPendingItem)
    .sort((a, b) => a.submittedAt - b.submittedAt);
}

/** Fila pendente reativa, para a UI (badge da home e tela de pendências — 170). */
export function usePendingMutations(): PendingOutboxItem[] {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<PendingOutboxItem[]>(() => listPendingMutations(queryClient));

  useEffect(() => {
    const cache = queryClient.getMutationCache();
    setItems(listPendingMutations(queryClient));
    return cache.subscribe(() => setItems(listPendingMutations(queryClient)));
  }, [queryClient]);

  return items;
}

// ── hook base das mutations de campo ──────────────────────────────────────────

export type OutboxMutationResult<TData, TInput, TVariables> = Omit<
  UseMutationResult<TData, unknown, TVariables>,
  'mutate' | 'mutateAsync'
> & {
  mutate: (input: TInput, options?: MutateOptions<TData, unknown, TVariables>) => void;
  mutateAsync: (
    input: TInput,
    options?: MutateOptions<TData, unknown, TVariables>,
  ) => Promise<TData>;
};

/**
 * Base de toda mutation de campo: declara **só** a `mutationKey` (a `mutationFn`
 * e a invalidação vivem em `setMutationDefaults`, única forma de a fila retomar
 * depois de fechar o app — função não é serializável).
 *
 * `toVariables` mantém a assinatura que as telas já usam: o que o hook fecha por
 * closure (houseId, activityId…) entra nas variáveis, que **são** serializadas.
 */
export function useOutboxMutation<TInput, TVariables extends OutboxVariables, TData = unknown>(
  mutationKey: OutboxMutationKey,
  toVariables: (input: TInput) => TVariables,
): OutboxMutationResult<TData, TInput, TVariables> {
  const mutation = useMutation<TData, unknown, TVariables>({ mutationKey });

  // A fábrica de variáveis muda de identidade a cada render (closure das telas);
  // a ref evita capturar uma versão velha sem recriar o objeto de retorno.
  const toVariablesRef = useRef(toVariables);
  toVariablesRef.current = toVariables;

  return {
    ...mutation,
    mutate: (input, options) => mutation.mutate(toVariablesRef.current(input), options),
    mutateAsync: (input, options) => mutation.mutateAsync(toVariablesRef.current(input), options),
  };
}

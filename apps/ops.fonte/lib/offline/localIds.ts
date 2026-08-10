/**
 * Ids locais de itens criados sem conexão (story 171, decisão 2).
 *
 * O operador cadastra um item de estoque no depósito, sem sinal, e **na mesma
 * hora** lança a movimentação dele. O `createItem` ainda está na fila, então o
 * item que a movimentação referencia não tem id do servidor. Sem um id local o
 * formulário não teria o que selecionar e o lançamento se perderia — que é
 * justamente o que o epic 167 proíbe.
 *
 * Como funciona:
 *
 * 1. a tela cria o item com um id sintético `local:<uuid>`, que entra no cache e
 *    pode ser escolhido no formulário como qualquer outro;
 * 2. quando o `createItem` sobe, o id real chega e o mapeamento
 *    `local:<uuid> → id real` é gravado (persistido: o replay pode acontecer
 *    depois de fechar o app);
 * 3. a movimentação da fila resolve o id **no envio** (`resolveLocalId`), então
 *    o backend nunca vê um id local.
 *
 * Se o item foi recusado pelo servidor, o mapeamento nunca existe: a movimentação
 * falha com `UnresolvedLocalIdError` e vai para a tela de pendências com um
 * motivo que o operador entende — nada é descartado em silêncio.
 *
 * O mapa guarda só par de ids (sem dado pessoal), mas é limpo no fim da sessão
 * junto do resto (`clearSessionData` em `lib/auth.tsx`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createUuid } from './uuid';

export const LOCAL_ID_PREFIX = 'local:';

export const LOCAL_ID_MAP_KEY = 'ops-fonte-local-ids';

/**
 * Teto de mapeamentos guardados. O mapa é ponte de curta duração entre a criação
 * e o replay, não histórico: sem teto ele cresceria para sempre no dispositivo.
 */
export const MAX_LOCAL_ID_ENTRIES = 100;

export function createLocalId(): string {
  return `${LOCAL_ID_PREFIX}${createUuid()}`;
}

export function isLocalId(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(LOCAL_ID_PREFIX);
}

/**
 * O item referenciado nunca chegou ao servidor. É falha **definitiva**: reenviar
 * a movimentação sozinha não resolve, o operador precisa reenviar o cadastro do
 * item antes (tela de pendências, story 170).
 */
export class UnresolvedLocalIdError extends Error {
  readonly localId: string;

  constructor(localId: string) {
    super('O item cadastrado sem conexão ainda não foi enviado. Reenvie o cadastro do item primeiro.');
    this.name = 'UnresolvedLocalIdError';
    this.localId = localId;
    Object.setPrototypeOf(this, UnresolvedLocalIdError.prototype);
  }
}

export function isUnresolvedLocalIdError(error: unknown): boolean {
  return error instanceof UnresolvedLocalIdError;
}

type LocalIdMap = Record<string, string>;

/** Cache em memória do mapa; `null` = ainda não lido do disco nesta sessão. */
let cache: LocalIdMap | null = null;

/** Serializa as escritas: dois itens subindo juntos não podem se sobrescrever. */
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(operation, operation);
  writeQueue = next.catch(() => undefined);
  return next;
}

function parse(raw: string | null): LocalIdMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    // Conteúdo corrompido não pode derrubar o envio: começa vazio.
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as LocalIdMap)
      : {};
  } catch {
    return {};
  }
}

async function read(): Promise<LocalIdMap> {
  if (cache) return cache;
  cache = parse(await AsyncStorage.getItem(LOCAL_ID_MAP_KEY));
  return cache;
}

async function write(map: LocalIdMap): Promise<void> {
  cache = map;
  await AsyncStorage.setItem(LOCAL_ID_MAP_KEY, JSON.stringify(map));
}

/** Grava `local:<uuid> → id real` assim que o item sobe. */
export function rememberLocalId(localId: string, realId: string): Promise<void> {
  if (!isLocalId(localId) || !realId) return Promise.resolve();

  return enqueue(async () => {
    const current = await read();
    const entries = Object.entries({ ...current, [localId]: realId });
    // Descarta os mais antigos primeiro (ordem de inserção do objeto).
    await write(Object.fromEntries(entries.slice(-MAX_LOCAL_ID_ENTRIES)));
  });
}

/**
 * Troca o id local pelo real na hora do envio. Id normal passa direto — é
 * seguro chamar em qualquer movimentação.
 */
export async function resolveLocalId(value: string): Promise<string> {
  if (!isLocalId(value)) return value;

  const resolved = (await enqueue(read))[value];
  if (!resolved) throw new UnresolvedLocalIdError(value);
  return resolved;
}

/** Item saiu da fila sem chegar ao servidor: o id local não vale mais nada. */
export function forgetLocalId(localId: string): Promise<void> {
  if (!isLocalId(localId)) return Promise.resolve();

  return enqueue(async () => {
    const current = await read();
    if (!(localId in current)) return;
    const { [localId]: _removed, ...rest } = current;
    await write(rest);
  });
}

/** Fim de sessão: o mapa some junto com o cache e a dead-letter. */
export function clearLocalIds(): Promise<void> {
  return enqueue(async () => {
    cache = {};
    await AsyncStorage.removeItem(LOCAL_ID_MAP_KEY);
  });
}

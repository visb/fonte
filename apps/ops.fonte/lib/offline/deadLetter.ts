/**
 * Dead-letter da outbox (story 169, decisão 5).
 *
 * Quando o React Query desiste de um item (rejeição do servidor ou transitório
 * esgotado) ele descarta a mutation do cache. Sem um store próprio o lançamento
 * do operador sumiria **em silêncio** — o oposto do invariante do epic 167. Aqui
 * ele fica persistido até alguém reenviar ou descartar explicitamente (tela de
 * pendências, story 170).
 *
 * LGPD: as variáveis guardadas são dado pessoal (nome de filho, ocorrência), por
 * isso a lista é limpa no logout e na sessão expirada, junto do cache do React
 * Query (`clearSessionData` em `lib/auth.tsx`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEAD_LETTER_KEY = 'ops-fonte-outbox-dead-letter';

/** Teto de itens guardados: a lista é fila de trabalho do operador, não histórico. */
export const MAX_DEAD_LETTER_ENTRIES = 50;

export interface DeadLetterEntry {
  /** Chave de idempotência do item — reenviar reusa a mesma chave (story 172). */
  id: string;
  /** Chave de mutation serializada (`storeroom/createMovement`). */
  mutationKey: string;
  label: string;
  variables: unknown;
  /** Mensagem do backend via `getErrorMessage` — é o que o operador lê. */
  error: string;
  failedAt: number;
}

type Listener = (entries: DeadLetterEntry[]) => void;

const listeners = new Set<Listener>();

/** Última leitura conhecida, para a UI ter valor síncrono no primeiro render. */
let snapshot: DeadLetterEntry[] = [];

/** Serializa as escritas: dois itens falhando juntos não podem se sobrescrever. */
let writeQueue: Promise<unknown> = Promise.resolve();

function notify(): void {
  listeners.forEach((listener) => listener(snapshot));
}

function parse(raw: string | null): DeadLetterEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DeadLetterEntry[]) : [];
  } catch {
    // Conteúdo corrompido não pode derrubar o app: começa vazio.
    return [];
  }
}

async function read(): Promise<DeadLetterEntry[]> {
  const raw = await AsyncStorage.getItem(DEAD_LETTER_KEY);
  snapshot = parse(raw);
  return snapshot;
}

async function write(entries: DeadLetterEntry[]): Promise<void> {
  snapshot = entries;
  await AsyncStorage.setItem(DEAD_LETTER_KEY, JSON.stringify(entries));
  notify();
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(operation, operation);
  writeQueue = next.catch(() => undefined);
  return next;
}

/** Lê do disco (fonte da verdade) e atualiza o snapshot síncrono. */
export function listDeadLetter(): Promise<DeadLetterEntry[]> {
  return enqueue(read);
}

/** Último valor lido, sem I/O — para o primeiro render da UI. */
export function getDeadLetterSnapshot(): DeadLetterEntry[] {
  return snapshot;
}

/** Grava a falha. Item com o mesmo id (mesma chave de idempotência) é atualizado. */
export function appendDeadLetter(entry: DeadLetterEntry): Promise<void> {
  return enqueue(async () => {
    const current = await read();
    const withoutDuplicate = current.filter((item) => item.id !== entry.id);
    await write([entry, ...withoutDuplicate].slice(0, MAX_DEAD_LETTER_ENTRIES));
  });
}

export function removeDeadLetter(id: string): Promise<void> {
  return enqueue(async () => {
    const current = await read();
    await write(current.filter((item) => item.id !== id));
  });
}

/** Esvazia a lista (descarte pelo operador e fim de sessão). */
export function clearDeadLetter(): Promise<void> {
  return enqueue(async () => {
    snapshot = [];
    await AsyncStorage.removeItem(DEAD_LETTER_KEY);
    notify();
  });
}

export function subscribeDeadLetter(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

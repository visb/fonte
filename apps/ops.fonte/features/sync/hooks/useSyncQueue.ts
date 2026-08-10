/**
 * Fila de sincronização vista pelo operador (story 170).
 *
 * Junta as duas origens que a story 169 deixou — mutations ainda em voo
 * (`usePendingMutations`) e a dead-letter persistida — num modelo único. São
 * estados diferentes com ações diferentes (decisão 2), então a tela recebe as
 * duas listas separadas, já ordenadas e com rótulo/detalhe prontos.
 *
 * Invariante do epic 167: **nada sai daqui em silêncio**. Reenviar e descartar
 * são ações explícitas do operador; falta de rede não descarta nada.
 */
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { discardOutboxFile } from '@/lib/offline/attachments';
import {
  getDeadLetterSnapshot,
  listDeadLetter,
  removeDeadLetter,
  subscribeDeadLetter,
  type DeadLetterEntry,
} from '@/lib/offline/deadLetter';
import { enqueueOutboxMutation } from '@/lib/offline/mutationDefaults';
import {
  usePendingMutations,
  type OutboxMutationKey,
  type OutboxVariables,
  type PendingOutboxItem,
} from '@/lib/offline/outbox';
import { syncItemDetail, syncItemLabel } from '../constants';

export type SyncItemStatus = 'pending' | 'failed';

interface SyncQueueItemBase {
  /** Único na tela: a origem entra no id porque os dois espaços de id são distintos. */
  id: string;
  mutationKey: string;
  label: string;
  detail: string | null;
  createdAt: number;
  variables: unknown;
}

/** Ainda em voo: sobe sozinho quando a rede voltar. */
export interface PendingSyncItem extends SyncQueueItemBase {
  status: 'pending';
  /** `mutationId` do React Query — estável enquanto o item está na fila. */
  mutationId: number;
}

/** Recusado pelo servidor: só sai da tela por ação do operador. */
export interface FailedSyncItem extends SyncQueueItemBase {
  status: 'failed';
  /** Chave de idempotência: id do item na dead-letter e no reenvio (story 172). */
  entryId: string;
  /** Mensagem do backend — é o que o operador lê para decidir. */
  error: string;
}

/**
 * União discriminada de propósito: item pendente **tem** `mutationId` e item
 * recusado **tem** `entryId` e erro. Um tipo só, com tudo opcional, obrigaria a
 * guardas defensivas que escondem a origem real de cada ação.
 */
export type SyncQueueItem = PendingSyncItem | FailedSyncItem;

function toPendingSyncItem(item: PendingOutboxItem): PendingSyncItem {
  return {
    id: `pending:${item.id}`,
    status: 'pending',
    mutationKey: item.mutationKey,
    label: item.label,
    detail: syncItemDetail(item.mutationKey, item.variables),
    createdAt: item.submittedAt,
    variables: item.variables,
    mutationId: item.id,
  };
}

function toFailedSyncItem(entry: DeadLetterEntry): FailedSyncItem {
  return {
    id: `failed:${entry.id}`,
    status: 'failed',
    mutationKey: entry.mutationKey,
    // O rótulo gravado na falha continua valendo; o catálogo cobre entrada antiga.
    label: entry.label || syncItemLabel(entry.mutationKey),
    detail: syncItemDetail(entry.mutationKey, entry.variables),
    error: entry.error,
    createdAt: entry.failedAt,
    variables: entry.variables,
    entryId: entry.id,
  };
}

/** Mais recente primeiro: o operador procura o que acabou de lançar. */
function byNewest(a: SyncQueueItem, b: SyncQueueItem): number {
  return b.createdAt - a.createdAt;
}

interface DeadLetterState {
  entries: DeadLetterEntry[];
  isLoading: boolean;
  error: unknown;
}

/**
 * Dead-letter reativa. O snapshot síncrono evita piscar vazio no primeiro
 * render; a leitura do disco é a fonte da verdade e as mudanças chegam pelo
 * `subscribeDeadLetter` (o mesmo canal que o `MutationCache.onError` alimenta).
 */
function useDeadLetterEntries(): DeadLetterState {
  const [state, setState] = useState<DeadLetterState>(() => ({
    entries: getDeadLetterSnapshot(),
    isLoading: true,
    error: null,
  }));

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeDeadLetter((entries) => {
      if (active) setState({ entries, isLoading: false, error: null });
    });

    listDeadLetter()
      .then((entries) => {
        if (active) setState({ entries, isLoading: false, error: null });
      })
      .catch((error: unknown) => {
        if (active) setState({ entries: [], isLoading: false, error });
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return state;
}

export interface SyncQueue {
  /** Esperando rede (ou tentando agora): sobem sozinhas. */
  pending: PendingSyncItem[];
  /** Recusadas pelo servidor: só saem por ação do operador. */
  failed: FailedSyncItem[];
  items: SyncQueueItem[];
  total: number;
  isLoading: boolean;
  error: unknown;
}

export function useSyncQueue(): SyncQueue {
  const pendingMutations = usePendingMutations();
  const { entries, isLoading, error } = useDeadLetterEntries();

  return useMemo(() => {
    const pending = pendingMutations.map(toPendingSyncItem).sort(byNewest);
    const failed = entries.map(toFailedSyncItem).sort(byNewest);
    return {
      pending,
      failed,
      items: [...pending, ...failed].sort(byNewest),
      total: pending.length + failed.length,
      isLoading,
      error,
    };
  }, [pendingMutations, entries, isLoading, error]);
}

/**
 * Só o total, para o badge da home: a home não monta a lista nem lê variáveis
 * (dado pessoal) para dizer que existe coisa por sincronizar.
 */
export function useSyncQueueCount(): number {
  const pendingMutations = usePendingMutations();
  const { entries } = useDeadLetterEntries();
  return pendingMutations.length + entries.length;
}

/** Caminho do anexo copiado para a outbox, quando o item tem um (story 169). */
function attachmentPathOf(variables: unknown): string | undefined {
  return (variables as { photoPath?: string } | null | undefined)?.photoPath;
}

/**
 * Reenvia um item recusado com as **mesmas variáveis** — inclusive a chave de
 * idempotência (story 172), que vive nelas: o backend devolve a resposta
 * original em vez de duplicar o lançamento se a primeira tentativa chegou lá.
 *
 * Sai da dead-letter antes de reenfileirar; se falhar de novo, o
 * `MutationCache.onError` a regrava. Sem rede, o item apenas volta para
 * "Aguardando envio".
 */
export function useRetryFailed() {
  const queryClient = useQueryClient();

  return useMutation({
    // Ação local do operador: não depende de rede para acontecer.
    networkMode: 'always',
    mutationFn: async (item: FailedSyncItem) => {
      await removeDeadLetter(item.entryId);
      enqueueOutboxMutation(
        queryClient,
        item.mutationKey.split('/') as unknown as OutboxMutationKey,
        item.variables as OutboxVariables,
      );
    },
  });
}

/**
 * Descarte explícito: perda deliberada de um lançamento de campo, sempre
 * confirmada na UI (decisão 3). Some da origem certa e leva junto o anexo
 * copiado, para não deixar arquivo órfão em `documentDirectory/outbox/`
 * (decisão 6).
 */
export function useDiscardItem() {
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: 'always',
    mutationFn: async (item: SyncQueueItem) => {
      await discardOutboxFile(attachmentPathOf(item.variables));

      if (item.status === 'failed') {
        await removeDeadLetter(item.entryId);
        return;
      }

      const cache = queryClient.getMutationCache();
      const mutation = cache.getAll().find((entry) => entry.mutationId === item.mutationId);
      // Tirar do cache impede o `resumePausedMutations` de ressuscitar o item.
      if (mutation) cache.remove(mutation);
    },
  });
}

/**
 * Fila de sincronização vista pela tela (story 170).
 *
 * Usa o `queryClient` real do app de propósito: é ele que carrega o
 * `MutationCache.onError` que alimenta a dead-letter, e é sobre esse par
 * (fila pendente + dead-letter) que a tela inteira é construída.
 */
import React, { type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { MovementType } from '@fonte/types';

jest.mock('@/lib/api', () => ({
  api: {
    census: { addResident: jest.fn(), conclude: jest.fn() },
    residents: { update: jest.fn(), uploadPhoto: jest.fn() },
    incidents: { create: jest.fn() },
    storeroom: { createMovement: jest.fn(), createItem: jest.fn() },
    supplyRoom: { createMovement: jest.fn(), createItem: jest.fn() },
    streetSales: { create: jest.fn(), update: jest.fn() },
    activities: { create: jest.fn(), addComment: jest.fn() },
  },
}));

jest.mock('@/lib/offline/attachments', () => ({
  persistOutboxFile: jest.fn(async (uri: string) => uri),
  buildFormDataFromOutboxFile: jest.fn(async () => new FormData()),
  discardOutboxFile: jest.fn(async () => undefined),
}));

import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { discardOutboxFile } from '@/lib/offline/attachments';
import { appendDeadLetter, clearDeadLetter, listDeadLetter } from '@/lib/offline/deadLetter';
import { registerMutationDefaults } from '@/lib/offline/mutationDefaults';
import { OUTBOX_MUTATION_KEYS, type OutboxMutationKey } from '@/lib/offline/outbox';
import {
  useDiscardItem,
  useRetryFailed,
  useSyncQueue,
  useSyncQueueCount,
} from './useSyncQueue';

const m = api as unknown as Record<string, Record<string, jest.Mock>>;
const discardFile = discardOutboxFile as jest.Mock;

function networkError(): Error {
  return new Error('Network Error');
}

function movementVariables(itemId = 'i1', idempotencyKey?: string) {
  return {
    ...(idempotencyKey ? { idempotencyKey } : {}),
    data: {
      itemId,
      type: MovementType.OUT,
      quantity: 3,
      responsibleId: 'staff-1',
      date: '2026-08-10',
      notes: null,
    },
  };
}

/** Enfileira como a tela de campo faz (sem esperar: offline o resultado não vem). */
function enqueue(key: OutboxMutationKey, variables: unknown) {
  const mutation = queryClient
    .getMutationCache()
    .build(queryClient, { ...queryClient.getMutationDefaults(key), mutationKey: key } as never);
  void mutation.execute(variables as never).catch(() => undefined);
  return mutation;
}

function deadLetterEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'idem-failed',
    mutationKey: 'storeroom/createMovement',
    label: 'Movimentação da dispensa',
    variables: movementVariables('i9', 'idem-failed'),
    error: 'Quantidade indisponível em estoque.',
    failedAt: 1_000,
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function useHarness() {
  return {
    queue: useSyncQueue(),
    retry: useRetryFailed(),
    discard: useDiscardItem(),
  };
}

beforeAll(() => {
  queryClient.setDefaultOptions({
    ...queryClient.getDefaultOptions(),
    mutations: { gcTime: Infinity },
  });
  registerMutationDefaults(queryClient, { retryDelay: 1 });
});

beforeEach(async () => {
  jest.clearAllMocks();
  queryClient.getMutationCache().clear();
  queryClient.clear();
  await AsyncStorage.clear();
  await clearDeadLetter();
  onlineManager.setOnline(true);
});

afterAll(() => {
  queryClient.getMutationCache().clear();
  onlineManager.setOnline(true);
});

describe('useSyncQueue', () => {
  it('fila vazia é estado vazio, não erro', async () => {
    const { result } = renderHook(() => useSyncQueue(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.total).toBe(0);
    expect(result.current.pending).toEqual([]);
    expect(result.current.failed).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('mescla pendentes e dead-letter, com o status de cada origem', async () => {
    onlineManager.setOnline(false);
    m.storeroom.createMovement.mockRejectedValue(networkError());
    await appendDeadLetter(deadLetterEntry());
    enqueue(OUTBOX_MUTATION_KEYS.storeroomCreateMovement, movementVariables('i1'));

    const { result } = renderHook(() => useSyncQueue(), { wrapper });

    await waitFor(() => expect(result.current.total).toBe(2));
    expect(result.current.pending).toHaveLength(1);
    expect(result.current.pending[0]).toMatchObject({
      status: 'pending',
      mutationKey: 'storeroom/createMovement',
      label: 'Movimentação da dispensa',
      detail: 'Saída de 3',
    });
    // Pendente não carrega erro: falta de rede não é falha (epic 167).
    expect(result.current.pending[0]).not.toHaveProperty('error');
    expect(result.current.failed[0]).toMatchObject({
      status: 'failed',
      error: 'Quantidade indisponível em estoque.',
      entryId: 'idem-failed',
      createdAt: 1_000,
    });
  });

  it('ordena por data, do mais recente para o mais antigo', async () => {
    await appendDeadLetter(deadLetterEntry({ id: 'antigo', failedAt: 1_000 }));
    await appendDeadLetter(deadLetterEntry({ id: 'recente', failedAt: 5_000 }));

    const { result } = renderHook(() => useSyncQueue(), { wrapper });

    await waitFor(() => expect(result.current.total).toBe(2));
    expect(result.current.failed.map((item) => item.entryId)).toEqual(['recente', 'antigo']);
    expect(result.current.items.map((item) => item.id)).toEqual([
      'failed:recente',
      'failed:antigo',
    ]);
  });

  it('falha ao ler o disco vira erro na tela, não lista vazia mentirosa', async () => {
    const original = AsyncStorage.getItem;
    AsyncStorage.getItem = jest.fn().mockRejectedValue(new Error('disco indisponível'));

    try {
      const { result } = renderHook(() => useSyncQueue(), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.error).toBeInstanceOf(Error);
    } finally {
      AsyncStorage.getItem = original;
    }
  });

  it('desmontar a tela não deixa atualização pendente', async () => {
    const { result, unmount } = renderHook(() => useSyncQueue(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    unmount();

    // Falha só o item novo — a tela já saiu; nada pode ser atualizado por baixo.
    await act(async () => {
      await appendDeadLetter(deadLetterEntry({ id: 'depois' }));
    });
    expect((await listDeadLetter()).map((entry) => entry.id)).toEqual(['depois']);
  });

  it('item da dead-letter sem rótulo gravado cai no catálogo', async () => {
    await appendDeadLetter(deadLetterEntry({ label: '' }));

    const { result } = renderHook(() => useSyncQueue(), { wrapper });

    await waitFor(() => expect(result.current.total).toBe(1));
    expect(result.current.failed[0].label).toBe('Movimentação da dispensa');
  });
});

describe('useSyncQueueCount', () => {
  it('soma as duas origens e zera com a fila vazia', async () => {
    onlineManager.setOnline(false);
    m.storeroom.createMovement.mockRejectedValue(networkError());

    const { result } = renderHook(() => useSyncQueueCount(), { wrapper });
    await waitFor(() => expect(result.current).toBe(0));

    await act(async () => {
      await appendDeadLetter(deadLetterEntry());
    });
    await waitFor(() => expect(result.current).toBe(1));

    enqueue(OUTBOX_MUTATION_KEYS.storeroomCreateMovement, movementVariables('i1'));
    await waitFor(() => expect(result.current).toBe(2));
  });
});

describe('useRetryFailed', () => {
  it('reenvio tira da dead-letter, reusa a chave de idempotência e envia', async () => {
    m.storeroom.createMovement.mockResolvedValue({ id: 'mv1' });
    await appendDeadLetter(deadLetterEntry());
    const { result } = renderHook(() => useHarness(), { wrapper });
    await waitFor(() => expect(result.current.queue.failed).toHaveLength(1));

    await act(async () => {
      await result.current.retry.mutateAsync(result.current.queue.failed[0]);
    });

    // A chave vive nas variáveis: reenviar não pode gerar outra, senão o
    // backend trata como lançamento novo (story 172).
    expect(m.storeroom.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'i9' }),
      { idempotencyKey: 'idem-failed' },
    );
    await waitFor(async () => expect(await listDeadLetter()).toEqual([]));
    await waitFor(() => expect(result.current.queue.total).toBe(0));
  });

  it('sem rede o item reenviado volta para "Aguardando envio", não para "Não enviadas"', async () => {
    onlineManager.setOnline(false);
    m.storeroom.createMovement.mockRejectedValue(networkError());
    await appendDeadLetter(deadLetterEntry());
    const { result } = renderHook(() => useHarness(), { wrapper });
    await waitFor(() => expect(result.current.queue.failed).toHaveLength(1));

    await act(async () => {
      await result.current.retry.mutateAsync(result.current.queue.failed[0]);
    });

    await waitFor(() => expect(result.current.queue.pending).toHaveLength(1));
    expect(result.current.queue.failed).toEqual([]);
    expect(await listDeadLetter()).toEqual([]);
  });
});

describe('useDiscardItem', () => {
  it('descarta item pendente tirando-o da fila para valer', async () => {
    onlineManager.setOnline(false);
    m.storeroom.createMovement.mockRejectedValue(networkError());
    enqueue(OUTBOX_MUTATION_KEYS.storeroomCreateMovement, movementVariables('i1'));
    const { result } = renderHook(() => useHarness(), { wrapper });
    await waitFor(() => expect(result.current.queue.pending).toHaveLength(1));

    await act(async () => {
      await result.current.discard.mutateAsync(result.current.queue.pending[0]);
    });

    await waitFor(() => expect(result.current.queue.total).toBe(0));
    // Descartado de verdade: a volta da rede não pode ressuscitar o lançamento.
    onlineManager.setOnline(true);
    m.storeroom.createMovement.mockResolvedValue({ id: 'mv1' });
    await act(async () => {
      await queryClient.resumePausedMutations();
    });
    expect(m.storeroom.createMovement).toHaveBeenCalledTimes(1);
  });

  it('descartar duas vezes o mesmo item não quebra', async () => {
    onlineManager.setOnline(false);
    m.storeroom.createMovement.mockRejectedValue(networkError());
    enqueue(OUTBOX_MUTATION_KEYS.storeroomCreateMovement, movementVariables('i1'));
    const { result } = renderHook(() => useHarness(), { wrapper });
    await waitFor(() => expect(result.current.queue.pending).toHaveLength(1));
    const item = result.current.queue.pending[0];

    await act(async () => {
      await result.current.discard.mutateAsync(item);
      // Toque duplo do operador: o item já saiu do cache na primeira vez.
      await result.current.discard.mutateAsync(item);
    });

    await waitFor(() => expect(result.current.queue.total).toBe(0));
  });

  it('descarta item recusado removendo só ele da dead-letter', async () => {
    await appendDeadLetter(deadLetterEntry({ id: 'a', failedAt: 1_000 }));
    await appendDeadLetter(deadLetterEntry({ id: 'b', failedAt: 2_000 }));
    const { result } = renderHook(() => useHarness(), { wrapper });
    await waitFor(() => expect(result.current.queue.failed).toHaveLength(2));

    await act(async () => {
      await result.current.discard.mutateAsync(result.current.queue.failed[0]);
    });

    expect((await listDeadLetter()).map((entry) => entry.id)).toEqual(['a']);
    await waitFor(() => expect(result.current.queue.total).toBe(1));
  });

  it('descarte apaga o anexo copiado do item (nada de arquivo órfão)', async () => {
    await appendDeadLetter(
      deadLetterEntry({
        mutationKey: 'residents/uploadPhoto',
        label: 'Foto do filho',
        variables: { residentId: 'r1', photoPath: 'file:///outbox/foto.jpg' },
      }),
    );
    const { result } = renderHook(() => useHarness(), { wrapper });
    await waitFor(() => expect(result.current.queue.failed).toHaveLength(1));

    await act(async () => {
      await result.current.discard.mutateAsync(result.current.queue.failed[0]);
    });

    expect(discardFile).toHaveBeenCalledWith('file:///outbox/foto.jpg');
  });

  it('item sem anexo não tenta apagar arquivo nenhum', async () => {
    await appendDeadLetter(deadLetterEntry());
    const { result } = renderHook(() => useHarness(), { wrapper });
    await waitFor(() => expect(result.current.queue.failed).toHaveLength(1));

    await act(async () => {
      await result.current.discard.mutateAsync(result.current.queue.failed[0]);
    });

    expect(discardFile).toHaveBeenCalledWith(undefined);
  });
});

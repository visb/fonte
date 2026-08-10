/**
 * Teste de integração do motor da outbox (story 169): fila pausada sem rede,
 * replay na volta do sinal, rejeição do servidor indo para a dead-letter e erro
 * de rede que **não** tira o item da fila.
 *
 * Usa o `queryClient` real do app de propósito — é ele que carrega o
 * `MutationCache.onError` que alimenta a dead-letter.
 */
import React, { type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClientProvider, dehydrate, hydrate, onlineManager } from '@tanstack/react-query';
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

import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { clearDeadLetter, listDeadLetter } from './deadLetter';
import { registerMutationDefaults } from './mutationDefaults';
import { dehydrateOptions } from './persister';
import { OUTBOX_MUTATION_KEYS, usePendingMutations, type OutboxMutationKey } from './outbox';

const m = api as unknown as Record<string, Record<string, jest.Mock>>;

/** Erro de rede do axios: sem `response`, que é o que distingue rede de rejeição. */
function networkError(): Error {
  return new Error('Network Error');
}

function rejection(status: number, message: string) {
  return { response: { status, data: { message } } };
}

function movement(itemId: string) {
  return {
    data: {
      itemId,
      type: MovementType.OUT,
      quantity: 1,
      responsibleId: 'staff-1',
      date: '2026-08-10',
      notes: null,
    },
  };
}

/** Enfileira como a tela faz, sem esperar o resultado (offline ele não vem). */
function enqueue(key: OutboxMutationKey, variables: unknown) {
  const mutation = queryClient
    .getMutationCache()
    .build(queryClient, { ...queryClient.getMutationDefaults(key), mutationKey: key } as never);
  void mutation.execute(variables as never).catch(() => undefined);
  return mutation;
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeAll(() => {
  // `gcTime: Infinity` só para o timer de coleta não segurar o processo do jest.
  queryClient.setDefaultOptions({
    ...queryClient.getDefaultOptions(),
    mutations: { gcTime: Infinity },
  });
  // Retry real (rede repete para sempre), mas sem espera entre tentativas.
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

describe('sem rede', () => {
  it('o lançamento fica pausado na fila (não falha) e é visível para a UI', async () => {
    onlineManager.setOnline(false);
    m.storeroom.createMovement.mockRejectedValue(networkError());

    enqueue(OUTBOX_MUTATION_KEYS.storeroomCreateMovement, movement('i1'));
    const { result } = renderHook(() => usePendingMutations(), { wrapper });

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0]).toMatchObject({
      mutationKey: 'storeroom/createMovement',
      label: 'Movimentação do almoxarifado',
    });
    await waitFor(() => expect(result.current[0].isPaused).toBe(true));
    expect(await listDeadLetter()).toEqual([]);
  });

  it('o item pausado é desidratado e volta da reidratação pronto para reenvio', async () => {
    onlineManager.setOnline(false);
    m.storeroom.createMovement.mockRejectedValue(networkError());
    enqueue(OUTBOX_MUTATION_KEYS.storeroomCreateMovement, movement('i1'));
    await waitFor(() =>
      expect(queryClient.getMutationCache().getAll()[0].state.isPaused).toBe(true),
    );

    // Round-trip pelo disco: só sobrevive o que for serializável.
    const dehydrated = JSON.parse(
      JSON.stringify(dehydrate(queryClient, dehydrateOptions)),
    ) as ReturnType<typeof dehydrate>;
    expect(dehydrated.mutations).toHaveLength(1);
    expect(dehydrated.mutations[0].state.variables).toMatchObject({
      data: { itemId: 'i1' },
      idempotencyKey: expect.any(String),
    });

    queryClient.getMutationCache().clear();
    hydrate(queryClient, dehydrated);

    const restored = queryClient.getMutationCache().getAll();
    expect(restored).toHaveLength(1);
    // Sem o default registrado por mutationKey, a mutation reidratada não teria
    // como ser reenviada — é o ponto inteiro da decisão 1.
    expect(typeof restored[0].options.mutationFn).toBe('function');

    m.storeroom.createMovement.mockResolvedValue({ id: 'mv1' });
    onlineManager.setOnline(true);
    await queryClient.resumePausedMutations();

    expect(m.storeroom.createMovement).toHaveBeenLastCalledWith(
      expect.objectContaining({ itemId: 'i1' }),
      { idempotencyKey: dehydrated.mutations[0].state.variables.idempotencyKey },
    );
  });

  it('a volta da rede reenvia com a MESMA chave de idempotência', async () => {
    onlineManager.setOnline(false);
    m.storeroom.createMovement.mockRejectedValue(networkError());
    enqueue(OUTBOX_MUTATION_KEYS.storeroomCreateMovement, movement('i1'));
    await waitFor(() =>
      expect(queryClient.getMutationCache().getAll()[0].state.isPaused).toBe(true),
    );

    m.storeroom.createMovement.mockResolvedValue({ id: 'mv1' });
    onlineManager.setOnline(true);
    await queryClient.resumePausedMutations();

    const keys = m.storeroom.createMovement.mock.calls.map((call) => call[1].idempotencyKey);
    expect(new Set(keys).size).toBe(1);
    // Enviado: sai da fila de pendentes (a coleta do item é do React Query).
    await waitFor(() =>
      expect(queryClient.getMutationCache().getAll()[0].state.status).toBe('success'),
    );
  });

  it('erro de rede não tira o item da fila nem vira dead-letter', async () => {
    onlineManager.setOnline(false);
    m.storeroom.createMovement.mockRejectedValue(networkError());

    enqueue(OUTBOX_MUTATION_KEYS.storeroomCreateMovement, movement('i1'));

    await waitFor(() =>
      expect(queryClient.getMutationCache().getAll()[0].state.isPaused).toBe(true),
    );
    expect(queryClient.getMutationCache().getAll()).toHaveLength(1);
    expect(await listDeadLetter()).toEqual([]);
  });
});

describe('rejeição do servidor', () => {
  it('sai da fila e vai para a dead-letter com a mensagem do backend', async () => {
    m.storeroom.createMovement.mockRejectedValue(
      rejection(422, 'Quantidade indisponível em estoque.'),
    );

    enqueue(OUTBOX_MUTATION_KEYS.storeroomCreateMovement, movement('i1'));

    await waitFor(async () => expect(await listDeadLetter()).toHaveLength(1));
    const [entry] = await listDeadLetter();
    expect(entry).toMatchObject({
      mutationKey: 'storeroom/createMovement',
      label: 'Movimentação do almoxarifado',
      error: 'Quantidade indisponível em estoque.',
    });
    // Uma tentativa só: 4xx de regra não se resolve repetindo.
    expect(m.storeroom.createMovement).toHaveBeenCalledTimes(1);
  });

  it('o operador vê a fila esvaziar do item rejeitado', async () => {
    m.incidents.create.mockRejectedValue(rejection(403, 'Sem permissão nesta casa.'));
    const { result } = renderHook(() => usePendingMutations(), { wrapper });

    enqueue(OUTBOX_MUTATION_KEYS.incidentCreate, { data: { houseId: 'h1' } });

    await waitFor(() => expect(result.current).toHaveLength(0));
    const [entry] = await listDeadLetter();
    expect(entry.error).toBe('Sem permissão nesta casa.');
  });
});

describe('FIFO tolerante a falha individual (decisão 3)', () => {
  it('item rejeitado no meio não bloqueia os seguintes', async () => {
    onlineManager.setOnline(false);
    m.storeroom.createMovement.mockRejectedValue(networkError());
    enqueue(OUTBOX_MUTATION_KEYS.storeroomCreateMovement, movement('i1'));
    enqueue(OUTBOX_MUTATION_KEYS.storeroomCreateMovement, movement('i2'));
    enqueue(OUTBOX_MUTATION_KEYS.storeroomCreateMovement, movement('i3'));
    await waitFor(() =>
      expect(
        queryClient
          .getMutationCache()
          .getAll()
          .filter((mutation) => mutation.state.isPaused),
      ).toHaveLength(3),
    );

    m.storeroom.createMovement.mockImplementation((data: { itemId: string }) =>
      data.itemId === 'i2'
        ? Promise.reject(rejection(409, 'Movimento duplicado.'))
        : Promise.resolve({ id: `mv-${data.itemId}` }),
    );
    onlineManager.setOnline(true);
    await queryClient.resumePausedMutations();

    const sent = m.storeroom.createMovement.mock.calls
      .map((call) => call[0].itemId)
      .filter((itemId, index, all) => all.indexOf(itemId) === index);
    expect(sent).toEqual(['i1', 'i2', 'i3']);
    await waitFor(async () => expect(await listDeadLetter()).toHaveLength(1));
    expect((await listDeadLetter())[0].error).toBe('Movimento duplicado.');
  });
});

describe('sucesso online', () => {
  it('envia e invalida o que a tela mostra', async () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    m.storeroom.createMovement.mockResolvedValue({ id: 'mv1' });

    enqueue(OUTBOX_MUTATION_KEYS.storeroomCreateMovement, movement('i1'));

    await waitFor(() => expect(m.storeroom.createMovement).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.storeroom.allItems }),
    );
    expect(await listDeadLetter()).toEqual([]);
    invalidate.mockRestore();
  });
});

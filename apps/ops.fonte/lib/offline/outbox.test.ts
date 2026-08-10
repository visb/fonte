import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, onlineManager } from '@tanstack/react-query';
import { clearDeadLetter, listDeadLetter } from './deadLetter';
import {
  MAX_SERVER_ERROR_RETRIES,
  OUTBOX_MUTATION_KEYS,
  OUTBOX_MUTATION_KEY_LIST,
  createIdempotencyKey,
  ensureIdempotencyKey,
  isDefinitiveFailure,
  isNetworkError,
  isOutboxEntityId,
  isOutboxMutationKey,
  listPendingMutations,
  outboxEntityId,
  outboxLabel,
  outboxRetry,
  recordOutboxFailure,
  serializeMutationKey,
  startOutboxReplay,
} from './outbox';

function httpError(status: number, message = 'erro do backend') {
  return { response: { status, data: { message } } };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await clearDeadLetter();
});

describe('catálogo de chaves', () => {
  it('toda chave é `[recurso, ação]` e única', () => {
    const serialized = OUTBOX_MUTATION_KEY_LIST.map(serializeMutationKey);

    expect(OUTBOX_MUTATION_KEY_LIST.length).toBeGreaterThan(0);
    OUTBOX_MUTATION_KEY_LIST.forEach((key) => expect(key).toHaveLength(2));
    expect(new Set(serialized).size).toBe(serialized.length);
  });

  it('reconhece só as chaves do catálogo', () => {
    expect(isOutboxMutationKey(OUTBOX_MUTATION_KEYS.storeroomCreateMovement)).toBe(true);
    expect(isOutboxMutationKey(['messages', 'send'])).toBe(false);
    expect(isOutboxMutationKey(undefined)).toBe(false);
    // Prefixo não basta: chave incompleta não é item da outbox.
    expect(isOutboxMutationKey(['storeroom'])).toBe(false);
  });

  it('toda chave tem rótulo humano (é o que o operador lê na fila)', () => {
    OUTBOX_MUTATION_KEY_LIST.forEach((key) => {
      expect(outboxLabel(key)).not.toBe('Lançamento pendente');
    });
    expect(outboxLabel(['nao', 'existe'])).toBe('Lançamento pendente');
  });
});

describe('chave de idempotência', () => {
  it('gera UUID no formato que o backend aceita (story 172)', () => {
    expect(createIdempotencyKey()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('gera UUID válido também sem WebCrypto (Hermes)', () => {
    const original = globalThis.crypto;
    // @ts-expect-error simula o runtime do RN sem WebCrypto
    delete globalThis.crypto;

    expect(createIdempotencyKey()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    // @ts-expect-error restaura
    globalThis.crypto = original;
  });

  it('é gerada uma vez e reusada em todo reenvio do mesmo item', () => {
    const variables: { idempotencyKey?: string } = {};

    const first = ensureIdempotencyKey(variables);
    const second = ensureIdempotencyKey(variables);

    expect(second).toBe(first);
    expect(variables.idempotencyKey).toBe(first);
  });

  it('id sintético do update otimista deriva da chave', () => {
    const id = outboxEntityId('abc');

    expect(isOutboxEntityId(id)).toBe(true);
    expect(isOutboxEntityId('uuid-real-do-backend')).toBe(false);
    expect(isOutboxEntityId(undefined)).toBe(false);
  });
});

describe('classificação de falha', () => {
  it('erro sem resposta é de rede (transitório, nunca definitivo)', () => {
    const networkError = new Error('Network Error');

    expect(isNetworkError(networkError)).toBe(true);
    expect(isDefinitiveFailure(networkError)).toBe(false);
    expect(isDefinitiveFailure(undefined)).toBe(false);
  });

  it.each([400, 403, 404, 409, 422])('%s é rejeição definitiva do servidor', (status) => {
    expect(isDefinitiveFailure(httpError(status))).toBe(true);
    expect(isNetworkError(httpError(status))).toBe(false);
  });

  it.each([408, 429, 500, 502, 503])('%s é transitório', (status) => {
    expect(isDefinitiveFailure(httpError(status))).toBe(false);
  });
});

describe('política de retry', () => {
  it('não repete rejeição definitiva', () => {
    expect(outboxRetry(0, httpError(422))).toBe(false);
  });

  it('repete erro de rede indefinidamente (o item fica pausado até voltar o sinal)', () => {
    expect(outboxRetry(0, new Error('Network Error'))).toBe(true);
    expect(outboxRetry(99, new Error('Network Error'))).toBe(true);
  });

  it('repete 5xx com limite para não girar para sempre', () => {
    expect(outboxRetry(0, httpError(500))).toBe(true);
    expect(outboxRetry(MAX_SERVER_ERROR_RETRIES, httpError(500))).toBe(false);
  });
});

describe('recordOutboxFailure', () => {
  function mutationDouble(mutationKey: readonly string[] | undefined, variables: unknown) {
    return {
      options: { mutationKey },
      state: { variables },
    } as never;
  }

  it('grava a falha final com a mensagem do backend', async () => {
    await recordOutboxFailure(
      httpError(422, 'Quantidade indisponível.'),
      mutationDouble(OUTBOX_MUTATION_KEYS.storeroomCreateMovement, {
        idempotencyKey: 'key-1',
        data: { itemId: 'i1' },
      }),
    );

    const entries = await listDeadLetter();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'key-1',
      mutationKey: 'storeroom/createMovement',
      label: 'Movimentação do almoxarifado',
      error: 'Quantidade indisponível.',
    });
  });

  it('ignora mutation fora do catálogo (fluxo que exige rede não vira fila)', async () => {
    await recordOutboxFailure(httpError(500), mutationDouble(['messages', 'send'], {}));

    expect(await listDeadLetter()).toEqual([]);
  });

  it('item sem chave de idempotência ainda é registrado (nada é descartado em silêncio)', async () => {
    await recordOutboxFailure(
      new Error('Network Error'),
      mutationDouble(OUTBOX_MUTATION_KEYS.incidentCreate, undefined),
    );

    const entries = await listDeadLetter();
    expect(entries).toHaveLength(1);
    expect(entries[0].error).toBe('Falha ao sincronizar o lançamento.');
  });
});

describe('listPendingMutations', () => {
  function buildMutation(
    queryClient: QueryClient,
    mutationKey: readonly string[],
    state: Record<string, unknown>,
  ) {
    queryClient.getMutationCache().build(
      queryClient,
      { mutationKey, mutationFn: async () => undefined },
      {
        context: undefined,
        data: undefined,
        error: null,
        failureCount: 0,
        failureReason: null,
        isPaused: false,
        status: 'idle',
        submittedAt: 0,
        variables: undefined,
        ...state,
      } as never,
    );
  }

  it('devolve os itens em voo, em ordem de entrada, ignorando os concluídos', () => {
    // `gcTime: Infinity` evita o timer de coleta segurar o processo do jest
    // (mutation pausada nunca é coletada enquanto está pendente).
    const queryClient = new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity } } });
    buildMutation(queryClient, OUTBOX_MUTATION_KEYS.incidentCreate, {
      status: 'pending',
      isPaused: true,
      submittedAt: 20,
      variables: { data: { houseId: 'h1' } },
    });
    buildMutation(queryClient, OUTBOX_MUTATION_KEYS.storeroomCreateMovement, {
      status: 'pending',
      isPaused: false,
      submittedAt: 10,
      variables: { data: { itemId: 'i1' } },
    });
    buildMutation(queryClient, OUTBOX_MUTATION_KEYS.censusConclude, { status: 'success' });
    buildMutation(queryClient, ['messages', 'send'], { status: 'pending', isPaused: true });

    const pending = listPendingMutations(queryClient);

    expect(pending.map((item) => item.mutationKey)).toEqual([
      'storeroom/createMovement',
      'incidents/create',
    ]);
    expect(pending[1]).toMatchObject({ label: 'Ocorrência', isPaused: true });
  });
});

describe('startOutboxReplay', () => {
  it('retoma a fila quando a rede volta e para depois do unsubscribe', () => {
    const queryClient = new QueryClient();
    const resume = jest
      .spyOn(queryClient, 'resumePausedMutations')
      .mockResolvedValue(undefined);
    const wasOnline = onlineManager.isOnline();

    const stop = startOutboxReplay(queryClient);

    onlineManager.setOnline(false);
    expect(resume).not.toHaveBeenCalled();

    onlineManager.setOnline(true);
    expect(resume).toHaveBeenCalledTimes(1);

    stop();
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
    expect(resume).toHaveBeenCalledTimes(1);

    onlineManager.setOnline(wasOnline);
  });
});

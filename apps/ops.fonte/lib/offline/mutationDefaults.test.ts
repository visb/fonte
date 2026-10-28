import { QueryClient } from '@tanstack/react-query';
import {
  ActivityStatus,
  IncidentCategory,
  IncidentType,
  MovementType,
  SupplyRoomCategory,
} from '@fonte/types';
import { queryKeys } from '@/lib/queryKeys';

jest.mock('@/lib/api', () => ({
  api: {
    census: { addResident: jest.fn(), conclude: jest.fn() },
    residents: { update: jest.fn(), uploadPhoto: jest.fn(), readmit: jest.fn() },
    incidents: { create: jest.fn() },
    storeroom: { createMovement: jest.fn(), createItem: jest.fn() },
    supplyRoom: { createMovement: jest.fn(), createItem: jest.fn() },
    streetSales: { create: jest.fn(), update: jest.fn() },
    activities: { create: jest.fn(), addComment: jest.fn() },
  },
}));

jest.mock('./attachments', () => ({
  persistOutboxFile: jest.fn().mockResolvedValue('file:///doc/outbox/foto.jpg'),
  buildFormDataFromOutboxFile: jest.fn().mockResolvedValue('form-data'),
  discardOutboxFile: jest.fn().mockResolvedValue(undefined),
}));

import { api } from '@/lib/api';
import { buildFormDataFromOutboxFile, discardOutboxFile, persistOutboxFile } from './attachments';
import { clearLocalIds, createLocalId, resolveLocalId } from './localIds';
import {
  OUTBOX_MUTATION_KEYS,
  OUTBOX_MUTATION_KEY_LIST,
  outboxEntityId,
  type OutboxMutationKey,
} from './outbox';
import {
  enqueueOutboxMutation,
  registerMutationDefaults,
  type RegisterMutationDefaultsOptions,
} from './mutationDefaults';

const m = api as unknown as Record<string, Record<string, jest.Mock>>;
const attachments = {
  persist: persistOutboxFile as jest.Mock,
  build: buildFormDataFromOutboxFile as jest.Mock,
  discard: discardOutboxFile as jest.Mock,
};

const idempotent = { idempotencyKey: expect.any(String) };

/**
 * `gcTime: Infinity` só para o jest não ficar preso no timer de coleta da
 * mutation; `retry: false` porque a política real repete rede para sempre.
 */
function createClient(options: RegisterMutationDefaultsOptions = { retry: false }): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { gcTime: Infinity }, queries: { gcTime: 0 } },
  });
  registerMutationDefaults(queryClient, options);
  return queryClient;
}

/** Executa a mutation pelo default registrado, como a fila faz. */
function run(queryClient: QueryClient, key: OutboxMutationKey, variables: unknown): Promise<unknown> {
  const defaults = queryClient.getMutationDefaults(key);
  const mutation = queryClient
    .getMutationCache()
    .build(queryClient, { ...defaults, mutationKey: key } as never);
  return mutation.execute(variables as never);
}

beforeEach(async () => {
  jest.clearAllMocks();
  Object.values(m).forEach((module) =>
    Object.values(module).forEach((fn) => fn.mockResolvedValue({ id: 'created' })),
  );
  attachments.persist.mockResolvedValue('file:///doc/outbox/foto.jpg');
  attachments.build.mockResolvedValue('form-data');
  await clearLocalIds();
});

describe('catálogo de defaults', () => {
  it('toda chave da outbox tem default com mutationFn, offlineFirst e retry', () => {
    const queryClient = createClient({});

    OUTBOX_MUTATION_KEY_LIST.forEach((key) => {
      const defaults = queryClient.getMutationDefaults(key);
      expect(typeof defaults.mutationFn).toBe('function');
      // Sem `offlineFirst` a mutation falharia sem rede em vez de pausar.
      expect(defaults.networkMode).toBe('offlineFirst');
      expect(typeof defaults.retry).toBe('function');
      expect(typeof defaults.onMutate).toBe('function');
    });
  });

  it('respeita o override de retry/retryDelay (usado nos testes)', () => {
    const queryClient = createClient({ retry: false, retryDelay: 5 });
    const defaults = queryClient.getMutationDefaults(
      OUTBOX_MUTATION_KEYS.storeroomCreateMovement,
    );

    expect(defaults.retry).toBe(false);
    expect(defaults.retryDelay).toBe(5);
  });
});

describe('envio com Idempotency-Key (contrato da story 172)', () => {
  const cases = [
    {
      name: 'census/addResident',
      key: OUTBOX_MUTATION_KEYS.censusAddResident,
      variables: { houseId: 'h1', data: { name: 'Novo' } },
      call: () => m.census.addResident,
      expected: [{ name: 'Novo' }, idempotent],
    },
    {
      name: 'census/conclude',
      key: OUTBOX_MUTATION_KEYS.censusConclude,
      variables: { houseId: 'h1', data: { houseId: 'h1' } },
      call: () => m.census.conclude,
      expected: [{ houseId: 'h1' }, idempotent],
    },
    {
      name: 'census/readmitResident',
      key: OUTBOX_MUTATION_KEYS.censusReadmitResident,
      variables: {
        houseId: 'h1',
        residentId: 'r9',
        residentName: 'Pedro',
        data: { houseId: 'h1', entryDate: '2026-10-01' },
      },
      call: () => m.residents.readmit,
      expected: ['r9', { houseId: 'h1', entryDate: '2026-10-01' }, idempotent],
    },
    {
      name: 'residents/updateStatus',
      key: OUTBOX_MUTATION_KEYS.residentUpdateStatus,
      variables: { houseId: 'h1', residentId: 'r1', data: { status: 'EVADED' } },
      call: () => m.residents.update,
      expected: ['r1', { status: 'EVADED' }, idempotent],
    },
    {
      name: 'incidents/create',
      key: OUTBOX_MUTATION_KEYS.incidentCreate,
      variables: { data: { houseId: 'h1', description: 'briga' } },
      call: () => m.incidents.create,
      expected: [{ houseId: 'h1', description: 'briga' }, idempotent],
    },
    {
      name: 'storeroom/createMovement',
      key: OUTBOX_MUTATION_KEYS.storeroomCreateMovement,
      variables: { data: { itemId: 'i1', type: MovementType.IN, quantity: 2 } },
      call: () => m.storeroom.createMovement,
      expected: [{ itemId: 'i1', type: MovementType.IN, quantity: 2 }, idempotent],
    },
    {
      name: 'storeroom/createItem',
      key: OUTBOX_MUTATION_KEYS.storeroomCreateItem,
      variables: { data: { name: 'Arroz', unit: 'kg', houseId: 'h1' } },
      call: () => m.storeroom.createItem,
      expected: [{ name: 'Arroz', unit: 'kg', houseId: 'h1' }, idempotent],
    },
    {
      name: 'supplyRoom/createMovement',
      key: OUTBOX_MUTATION_KEYS.supplyRoomCreateMovement,
      variables: { data: { itemId: 'i1', type: MovementType.OUT, quantity: 1 } },
      call: () => m.supplyRoom.createMovement,
      expected: [{ itemId: 'i1', type: MovementType.OUT, quantity: 1 }, idempotent],
    },
    {
      name: 'supplyRoom/createItem',
      key: OUTBOX_MUTATION_KEYS.supplyRoomCreateItem,
      variables: {
        data: { name: 'Sabão', unit: 'un', category: SupplyRoomCategory.CLEANING, houseId: 'h1' },
      },
      call: () => m.supplyRoom.createItem,
      expected: [
        { name: 'Sabão', unit: 'un', category: SupplyRoomCategory.CLEANING, houseId: 'h1' },
        idempotent,
      ],
    },
    {
      name: 'streetSales/create',
      key: OUTBOX_MUTATION_KEYS.streetSaleCreate,
      variables: { data: { houseId: 'h1', amountCents: 1000 } },
      call: () => m.streetSales.create,
      expected: [{ houseId: 'h1', amountCents: 1000 }, idempotent],
    },
    {
      name: 'streetSales/update',
      key: OUTBOX_MUTATION_KEYS.streetSaleUpdate,
      variables: { id: 's1', houseId: 'h1', data: { amountCents: 2000 } },
      call: () => m.streetSales.update,
      expected: ['s1', { amountCents: 2000 }, idempotent],
    },
    {
      name: 'activities/create',
      key: OUTBOX_MUTATION_KEYS.activityCreate,
      variables: { data: { title: 'Mutirão' } },
      call: () => m.activities.create,
      expected: [{ title: 'Mutirão' }, idempotent],
    },
    {
      name: 'activities/comment',
      key: OUTBOX_MUTATION_KEYS.activityComment,
      variables: { activityId: 'a1', data: { body: 'oi' } },
      call: () => m.activities.addComment,
      expected: ['a1', { body: 'oi' }, idempotent],
    },
  ];

  it.each(cases)('$name envia a chave no header', async ({ key, variables, call, expected }) => {
    const queryClient = createClient();

    await run(queryClient, key, variables);

    expect(call()).toHaveBeenCalledWith(...expected);
  });

  it('reenvio do mesmo item reusa a chave (é o que evita o lançamento duplicado)', async () => {
    const queryClient = createClient();
    const variables = { data: { itemId: 'i1', type: MovementType.IN, quantity: 2 } };

    await run(queryClient, OUTBOX_MUTATION_KEYS.storeroomCreateMovement, variables);
    await run(queryClient, OUTBOX_MUTATION_KEYS.storeroomCreateMovement, variables);

    const [first, second] = m.storeroom.createMovement.mock.calls;
    expect(second[1].idempotencyKey).toBe(first[1].idempotencyKey);
  });

  it('itens diferentes recebem chaves diferentes', async () => {
    const queryClient = createClient();

    await run(queryClient, OUTBOX_MUTATION_KEYS.storeroomCreateMovement, {
      data: { itemId: 'i1', type: MovementType.IN, quantity: 2 },
    });
    await run(queryClient, OUTBOX_MUTATION_KEYS.storeroomCreateMovement, {
      data: { itemId: 'i1', type: MovementType.IN, quantity: 2 },
    });

    const [first, second] = m.storeroom.createMovement.mock.calls;
    expect(second[1].idempotencyKey).not.toBe(first[1].idempotencyKey);
  });
});

describe('update otimista — movimentação de almoxarifado', () => {
  const variables = {
    data: {
      itemId: 'i1',
      type: MovementType.OUT,
      quantity: 3,
      responsibleId: 'staff-1',
      date: '2026-08-10',
      notes: null,
    },
    responsibleName: 'Irmão João',
  };

  function seed(queryClient: QueryClient) {
    queryClient.setQueryData(queryKeys.storeroom.items('h1'), [
      { id: 'i1', name: 'Arroz', unit: 'kg', currentQuantity: 10 },
      { id: 'i2', name: 'Feijão', unit: 'kg', currentQuantity: 4 },
    ]);
    queryClient.setQueryData(queryKeys.storeroom.movements('i1'), []);
  }

  it('baixa o estoque e insere o lançamento pendente na hora', async () => {
    const queryClient = createClient();
    seed(queryClient);
    let observed: unknown;
    m.storeroom.createMovement.mockImplementation(() => {
      observed = {
        items: queryClient.getQueryData(queryKeys.storeroom.items('h1')),
        movements: queryClient.getQueryData(queryKeys.storeroom.movements('i1')),
      };
      return Promise.resolve({ id: 'mv1' });
    });

    await run(queryClient, OUTBOX_MUTATION_KEYS.storeroomCreateMovement, { ...variables });

    const snapshot = observed as {
      items: Array<{ id: string; currentQuantity: number }>;
      movements: Array<{ id: string; quantity: number; responsible: { name: string } }>;
    };
    expect(snapshot.items).toEqual([
      expect.objectContaining({ id: 'i1', currentQuantity: 7 }),
      expect.objectContaining({ id: 'i2', currentQuantity: 4 }),
    ]);
    expect(snapshot.movements).toHaveLength(1);
    expect(snapshot.movements[0]).toMatchObject({
      quantity: 3,
      responsible: { name: 'Irmão João' },
      item: { name: 'Arroz', unit: 'kg' },
    });
  });

  it('entrada soma no estoque', async () => {
    const queryClient = createClient();
    seed(queryClient);
    let quantity: number | undefined;
    m.storeroom.createMovement.mockImplementation(() => {
      const items = queryClient.getQueryData<Array<{ id: string; currentQuantity: number }>>(
        queryKeys.storeroom.items('h1'),
      );
      quantity = items?.[0].currentQuantity;
      return Promise.resolve({ id: 'mv1' });
    });

    await run(queryClient, OUTBOX_MUTATION_KEYS.storeroomCreateMovement, {
      ...variables,
      data: { ...variables.data, type: MovementType.IN },
    });

    expect(quantity).toBe(13);
  });

  it('rejeição do servidor desfaz o lançamento (sem estorno fantasma no estoque)', async () => {
    const queryClient = createClient();
    seed(queryClient);
    m.storeroom.createMovement.mockRejectedValue({ response: { status: 422 } });

    await expect(
      run(queryClient, OUTBOX_MUTATION_KEYS.storeroomCreateMovement, { ...variables }),
    ).rejects.toBeDefined();

    expect(queryClient.getQueryData(queryKeys.storeroom.items('h1'))).toEqual([
      expect.objectContaining({ id: 'i1', currentQuantity: 10 }),
      expect.objectContaining({ id: 'i2', currentQuantity: 4 }),
    ]);
    expect(queryClient.getQueryData(queryKeys.storeroom.movements('i1'))).toEqual([]);
  });

  it('sucesso invalida itens e movimentações', async () => {
    const queryClient = createClient();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    await run(queryClient, OUTBOX_MUTATION_KEYS.storeroomCreateMovement, { ...variables });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.storeroom.allItems });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.storeroom.allMovements });
  });
});

describe('update otimista — despensa e ocorrência', () => {
  it('despensa: aplica e desfaz o movimento', async () => {
    const queryClient = createClient();
    queryClient.setQueryData(queryKeys.supplyRoom.items('h1'), [
      { id: 'i1', name: 'Sabão', unit: 'un', category: SupplyRoomCategory.CLEANING, currentQuantity: 5 },
    ]);
    queryClient.setQueryData(queryKeys.supplyRoom.movements('i1'), []);
    const variables = {
      data: {
        itemId: 'i1',
        type: MovementType.OUT,
        quantity: 2,
        responsibleId: 'staff-1',
        date: '2026-08-10',
        notes: null,
      },
    };
    let pending: unknown;
    m.supplyRoom.createMovement.mockImplementation(() => {
      pending = queryClient.getQueryData(queryKeys.supplyRoom.movements('i1'));
      return Promise.reject({ response: { status: 409 } });
    });

    await expect(
      run(queryClient, OUTBOX_MUTATION_KEYS.supplyRoomCreateMovement, { ...variables }),
    ).rejects.toBeDefined();

    expect(pending).toHaveLength(1);
    expect(queryClient.getQueryData(queryKeys.supplyRoom.movements('i1'))).toEqual([]);
    expect(queryClient.getQueryData(queryKeys.supplyRoom.items('h1'))).toEqual([
      expect.objectContaining({ currentQuantity: 5 }),
    ]);
  });

  it('ocorrência aparece na lista da casa e some no erro definitivo', async () => {
    const queryClient = createClient();
    queryClient.setQueryData(queryKeys.incidents.byHouse('h1'), []);
    const variables = {
      data: {
        date: '2026-08-10',
        type: IncidentType.POSITIVE,
        category: IncidentCategory.HELPING_OTHERS,
        description: 'briga',
        houseId: 'h1',
        responsibleId: 'staff-1',
        residentIds: ['r1', 'r2'],
      },
      responsibleName: 'Irmão João',
      residentNames: ['Carlos', 'Pedro'],
    };
    let pending: Array<{ id: string; residents: { name: string }[] }> | undefined;
    m.incidents.create.mockImplementation(() => {
      pending = queryClient.getQueryData(queryKeys.incidents.byHouse('h1'));
      return Promise.reject({ response: { status: 400 } });
    });

    await expect(
      run(queryClient, OUTBOX_MUTATION_KEYS.incidentCreate, { ...variables }),
    ).rejects.toBeDefined();

    // Story 227: otimista com N filhos, nomes na ordem dos ids.
    expect(pending?.[0]).toMatchObject({
      description: 'briga',
      // Story 229: o otimista carrega o tipo escolhido.
      type: IncidentType.POSITIVE,
      // Story 230: … e a categoria escolhida.
      category: IncidentCategory.HELPING_OTHERS,
      residents: [
        { id: 'r1', name: 'Carlos' },
        { id: 'r2', name: 'Pedro' },
      ],
      responsible: { name: 'Irmão João' },
    });
    expect(pending?.[0].id.startsWith(outboxEntityId(''))).toBe(true);
    expect(queryClient.getQueryData(queryKeys.incidents.byHouse('h1'))).toEqual([]);
    // O payload enviado não carrega os nomes do otimista.
    expect(m.incidents.create.mock.calls[0][0]).toEqual(variables.data);
  });

  it('ocorrência sem filho envolvido fica com residents vazio', async () => {
    const queryClient = createClient();
    queryClient.setQueryData(queryKeys.incidents.byHouse('h1'), []);
    let pending: Array<{ residents: unknown }> | undefined;
    m.incidents.create.mockImplementation(() => {
      pending = queryClient.getQueryData(queryKeys.incidents.byHouse('h1'));
      return Promise.resolve({ id: 'in1' });
    });

    await run(queryClient, OUTBOX_MUTATION_KEYS.incidentCreate, {
      data: {
        date: '2026-08-10',
        type: IncidentType.NEGATIVE,
        description: 'aviso',
        houseId: 'h1',
        responsibleId: 'staff-1',
      },
    });

    expect(pending?.[0].residents).toEqual([]);
  });

  // Item enfileirado por um APK anterior à story 227 (e à 229): só `residentId` +
  // `residentName`, com `severity` e sem `type`. Tem que aparecer pendente e
  // replayar com o payload intacto (o backend aceita os dois campos legados).
  it('replay de item legado da fila (residentId) mantém o payload e mostra o filho', async () => {
    const queryClient = createClient();
    queryClient.setQueryData(queryKeys.incidents.byHouse('h1'), []);
    const legacyData = {
      date: '2026-08-10',
      severity: 'MEDIUM',
      description: 'fuga',
      houseId: 'h1',
      responsibleId: 'staff-1',
      residentId: 'r9',
    };
    let pending:
      | Array<{ type: string; category: string | null; residents: { id: string; name: string }[] }>
      | undefined;
    m.incidents.create.mockImplementation(() => {
      pending = queryClient.getQueryData(queryKeys.incidents.byHouse('h1'));
      return Promise.resolve({ id: 'in9' });
    });

    await run(queryClient, OUTBOX_MUTATION_KEYS.incidentCreate, {
      data: legacyData,
      responsibleName: 'Irmão João',
      residentName: 'Tiago',
    });

    expect(pending?.[0].residents).toEqual([{ id: 'r9', name: 'Tiago' }]);
    // Story 229: sem `type`, o otimista resolve como NEGATIVE (igual ao backend)…
    expect(pending?.[0].type).toBe(IncidentType.NEGATIVE);
    // Story 230: sem categoria no item legado → "Sem categoria" (null), como no backend.
    expect(pending?.[0].category).toBeNull();
    // …e o corpo sobe intacto, com a `severity` legada e sem `type`/`category`.
    expect(m.incidents.create).toHaveBeenCalledWith(legacyData, idempotent);
    expect(m.incidents.create.mock.calls[0][0]).not.toHaveProperty('type');
    expect(m.incidents.create.mock.calls[0][0]).not.toHaveProperty('category');
  });

  it('legado sem nome e sobreposto a residentIds não duplica no otimista', async () => {
    const queryClient = createClient();
    queryClient.setQueryData(queryKeys.incidents.byHouse('h1'), []);
    let pending: Array<{ residents: { id: string; name: string }[] }> | undefined;
    m.incidents.create.mockImplementation(() => {
      pending = queryClient.getQueryData(queryKeys.incidents.byHouse('h1'));
      return Promise.resolve({ id: 'in1' });
    });

    await run(queryClient, OUTBOX_MUTATION_KEYS.incidentCreate, {
      data: {
        date: '2026-08-10',
        severity: 'LOW',
        description: 'x',
        houseId: 'h1',
        responsibleId: 'staff-1',
        residentIds: ['r1'],
        residentId: 'r1',
      },
    });
    expect(pending?.[0].residents).toEqual([{ id: 'r1', name: '' }]);

    await run(queryClient, OUTBOX_MUTATION_KEYS.incidentCreate, {
      data: {
        date: '2026-08-10',
        severity: 'LOW',
        description: 'y',
        houseId: 'h1',
        responsibleId: 'staff-1',
        residentId: 'r2',
      },
    });
    expect(pending?.[0].residents).toEqual([{ id: 'r2', name: '' }]);
  });
});

describe('item de estoque criado offline (story 171, decisão 2)', () => {
  it('entra na lista com o id local para poder ser movimentado na hora', async () => {
    const queryClient = createClient();
    queryClient.setQueryData(queryKeys.storeroom.items('h1'), []);
    const localId = createLocalId();
    let visible: Array<{ id: string; name: string; currentQuantity: number }> | undefined;
    m.storeroom.createItem.mockImplementation(() => {
      visible = queryClient.getQueryData(queryKeys.storeroom.items('h1'));
      return Promise.resolve({ id: 'item-real' });
    });

    await run(queryClient, OUTBOX_MUTATION_KEYS.storeroomCreateItem, {
      data: { name: 'Arroz', unit: 'kg', houseId: 'h1' },
      localId,
    });

    expect(visible).toEqual([
      expect.objectContaining({ id: localId, name: 'Arroz', currentQuantity: 0 }),
    ]);
  });

  it('depois de subir, a movimentação enfileirada sai com o id real', async () => {
    const queryClient = createClient();
    const localId = createLocalId();
    m.storeroom.createItem.mockResolvedValue({ id: 'item-real' });

    await run(queryClient, OUTBOX_MUTATION_KEYS.storeroomCreateItem, {
      data: { name: 'Arroz', unit: 'kg', houseId: 'h1' },
      localId,
    });
    await run(queryClient, OUTBOX_MUTATION_KEYS.storeroomCreateMovement, {
      data: { itemId: localId, type: MovementType.IN, quantity: 2 },
    });

    expect(m.storeroom.createMovement).toHaveBeenCalledWith(
      { itemId: 'item-real', type: MovementType.IN, quantity: 2 },
      idempotent,
    );
  });

  it('o mesmo vale para a despensa', async () => {
    const queryClient = createClient();
    const localId = createLocalId();
    m.supplyRoom.createItem.mockResolvedValue({ id: 'item-real' });

    await run(queryClient, OUTBOX_MUTATION_KEYS.supplyRoomCreateItem, {
      data: {
        name: 'Sabão',
        unit: 'un',
        category: SupplyRoomCategory.CLEANING,
        houseId: 'h1',
      },
      localId,
    });
    await run(queryClient, OUTBOX_MUTATION_KEYS.supplyRoomCreateMovement, {
      data: { itemId: localId, type: MovementType.OUT, quantity: 1 },
    });

    expect(m.supplyRoom.createMovement).toHaveBeenCalledWith(
      { itemId: 'item-real', type: MovementType.OUT, quantity: 1 },
      idempotent,
    );
  });

  it('cadastro recusado tira o item da lista e desfaz o mapeamento', async () => {
    const queryClient = createClient();
    queryClient.setQueryData(queryKeys.storeroom.items('h1'), []);
    const localId = createLocalId();
    m.storeroom.createItem.mockRejectedValue({ response: { status: 409 } });

    await expect(
      run(queryClient, OUTBOX_MUTATION_KEYS.storeroomCreateItem, {
        data: { name: 'Arroz', unit: 'kg', houseId: 'h1' },
        localId,
      }),
    ).rejects.toBeDefined();

    expect(queryClient.getQueryData(queryKeys.storeroom.items('h1'))).toEqual([]);
    await expect(resolveLocalId(localId)).rejects.toBeDefined();
  });

  it('cadastro de despensa recusado também tira o item local da lista', async () => {
    const queryClient = createClient();
    queryClient.setQueryData(queryKeys.supplyRoom.items('h1'), []);
    const localId = createLocalId();
    m.supplyRoom.createItem.mockRejectedValue({ response: { status: 400 } });

    await expect(
      run(queryClient, OUTBOX_MUTATION_KEYS.supplyRoomCreateItem, {
        data: {
          name: 'Sabão',
          unit: 'un',
          category: SupplyRoomCategory.CLEANING,
          houseId: 'h1',
        },
        localId,
      }),
    ).rejects.toBeDefined();

    expect(queryClient.getQueryData(queryKeys.supplyRoom.items('h1'))).toEqual([]);
    await expect(resolveLocalId(localId)).rejects.toBeDefined();
  });

  it('movimentação de item que nunca subiu falha com motivo, sem mandar `local:` ao backend', async () => {
    const queryClient = createClient();

    await expect(
      run(queryClient, OUTBOX_MUTATION_KEYS.storeroomCreateMovement, {
        data: { itemId: createLocalId(), type: MovementType.IN, quantity: 2 },
      }),
    ).rejects.toMatchObject({ name: 'UnresolvedLocalIdError' });

    expect(m.storeroom.createMovement).not.toHaveBeenCalled();
  });

  it('cadastro sem id local segue igual (fluxo online de sempre)', async () => {
    const queryClient = createClient();
    queryClient.setQueryData(queryKeys.storeroom.items('h1'), []);

    await run(queryClient, OUTBOX_MUTATION_KEYS.storeroomCreateItem, {
      data: { name: 'Arroz', unit: 'kg', houseId: 'h1' },
    });

    expect(queryClient.getQueryData(queryKeys.storeroom.items('h1'))).toEqual([]);
  });

  it('cadastro e movimentação do mesmo recurso sobem em série (o item antes do movimento)', () => {
    const queryClient = createClient();

    const item = queryClient.getMutationDefaults(OUTBOX_MUTATION_KEYS.storeroomCreateItem);
    const movement = queryClient.getMutationDefaults(
      OUTBOX_MUTATION_KEYS.storeroomCreateMovement,
    );

    expect(item.scope?.id).toBe('inventory');
    expect(movement.scope?.id).toBe(item.scope?.id);
  });
});

describe('update otimista — venda de rua e atividade (decisão 5)', () => {
  const sale = {
    data: {
      houseId: 'h1',
      date: '2026-08-10',
      type: 'BREAD',
      quantity: 10,
      amountPix: 1000,
      amountCash: 500,
      amountCard: 0,
    },
  };

  it('venda aparece na lista da casa com o total somado', async () => {
    const queryClient = createClient();
    queryClient.setQueryData(queryKeys.streetSales.byHouse('h1'), []);
    let visible: Array<{ id: string; totalAmount: number }> | undefined;
    m.streetSales.create.mockImplementation(() => {
      visible = queryClient.getQueryData(queryKeys.streetSales.byHouse('h1'));
      return Promise.resolve({ id: 'sale-1' });
    });

    await run(queryClient, OUTBOX_MUTATION_KEYS.streetSaleCreate, { ...sale });

    expect(visible?.[0]).toMatchObject({ quantity: 10, totalAmount: 1500 });
    expect(visible?.[0].id.startsWith(outboxEntityId(''))).toBe(true);
  });

  it('venda recusada some da lista', async () => {
    const queryClient = createClient();
    queryClient.setQueryData(queryKeys.streetSales.byHouse('h1'), []);
    m.streetSales.create.mockRejectedValue({ response: { status: 400 } });

    await expect(
      run(queryClient, OUTBOX_MUTATION_KEYS.streetSaleCreate, { ...sale }),
    ).rejects.toBeDefined();

    expect(queryClient.getQueryData(queryKeys.streetSales.byHouse('h1'))).toEqual([]);
  });

  it('atividade aparece na lista da casa e some no erro definitivo', async () => {
    const queryClient = createClient();
    queryClient.setQueryData(queryKeys.activities.byHouse('h1'), []);
    let visible: Array<{ id: string; title: string }> | undefined;
    m.activities.create.mockImplementation(() => {
      visible = queryClient.getQueryData(queryKeys.activities.byHouse('h1'));
      return Promise.reject({ response: { status: 403 } });
    });

    await expect(
      run(queryClient, OUTBOX_MUTATION_KEYS.activityCreate, {
        data: { title: 'Mutirão', houseId: 'h1' },
      }),
    ).rejects.toBeDefined();

    expect(visible?.[0]).toMatchObject({ title: 'Mutirão' });
    expect(queryClient.getQueryData(queryKeys.activities.byHouse('h1'))).toEqual([]);
  });

  it('atividade em A fazer com responsável aparece na coluna com o nome do cache (story 224)', async () => {
    const queryClient = createClient();
    queryClient.setQueryData(queryKeys.activities.byHouse('h1'), []);
    queryClient.setQueryData(queryKeys.staff.byHouse('h1'), [
      { id: 's1', name: 'Ana', userId: 'u1' },
      { id: 's2', name: 'Bruno' },
    ]);
    let visible: unknown[] | undefined;
    m.activities.create.mockImplementation(() => {
      visible = queryClient.getQueryData(queryKeys.activities.byHouse('h1'));
      return Promise.resolve({ id: 'a2' });
    });

    await run(queryClient, OUTBOX_MUTATION_KEYS.activityCreate, {
      data: { title: 'Varrer', houseId: 'h1', status: ActivityStatus.TODO, responsibleStaffId: 's2' },
    });

    expect(visible?.[0]).toMatchObject({
      status: ActivityStatus.TODO,
      responsibleStaffId: 's2',
      responsible: { id: 's2', name: 'Bruno', userId: '' },
    });
  });

  it('responsável fora do cache dos servos fica sem nome no card pendente (story 224)', async () => {
    const queryClient = createClient();
    queryClient.setQueryData(queryKeys.activities.byHouse('h1'), []);
    let visible: unknown[] | undefined;
    m.activities.create.mockImplementation(() => {
      visible = queryClient.getQueryData(queryKeys.activities.byHouse('h1'));
      return Promise.resolve({ id: 'a2' });
    });

    await run(queryClient, OUTBOX_MUTATION_KEYS.activityCreate, {
      data: { title: 'Varrer', houseId: 'h1', status: ActivityStatus.TODO, responsibleStaffId: 's9' },
    });

    expect(visible?.[0]).toMatchObject({ responsibleStaffId: 's9', responsible: null });
  });

  it('atividade sem casa não inventa entrada em lista nenhuma', async () => {
    const queryClient = createClient();
    queryClient.setQueryData(queryKeys.activities.byHouse('h1'), []);

    await run(queryClient, OUTBOX_MUTATION_KEYS.activityCreate, {
      data: { title: 'Sem casa', houseId: null },
    });

    expect(queryClient.getQueryData(queryKeys.activities.byHouse('h1'))).toEqual([]);
  });

  it('a entrada otimista não vaza para o detalhe nem para os comentários', async () => {
    const queryClient = createClient();
    queryClient.setQueryData(queryKeys.activities.byHouse('h1'), []);
    queryClient.setQueryData(queryKeys.activities.detail('a1'), { id: 'a1' });
    queryClient.setQueryData(queryKeys.activities.comments('a1'), []);
    let untouched: { detail: unknown; comments: unknown } | undefined;
    m.activities.create.mockImplementation(() => {
      untouched = {
        detail: queryClient.getQueryData(queryKeys.activities.detail('a1')),
        comments: queryClient.getQueryData(queryKeys.activities.comments('a1')),
      };
      return Promise.resolve({ id: 'a2' });
    });

    await run(queryClient, OUTBOX_MUTATION_KEYS.activityCreate, {
      data: { title: 'Mutirão', houseId: 'h1' },
    });

    // `activities.all` é prefixo de detail/comments: casar por prefixo teria
    // trocado o objeto do detalhe por uma lista.
    expect(untouched?.detail).toEqual({ id: 'a1' });
    expect(untouched?.comments).toEqual([]);
  });
});

describe('reacolhimento pela contagem (story 218)', () => {
  it('invalida a lista da casa, a ficha e a busca de reacolhimento', async () => {
    const queryClient = createClient();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    await run(queryClient, OUTBOX_MUTATION_KEYS.censusReadmitResident, {
      houseId: 'h1',
      residentId: 'r9',
      data: { houseId: 'h1', entryDate: '2026-10-01' },
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.residents.byHouse('h1') });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.residents.detail('r9') });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.residentLookup.all });
  });

  it('rejeição do servidor não some: o erro sobe para a fila (dead-letter / /sync)', async () => {
    const queryClient = createClient();
    m.residents.readmit.mockRejectedValue({ response: { status: 400 } });

    await expect(
      run(queryClient, OUTBOX_MUTATION_KEYS.censusReadmitResident, {
        houseId: 'h1',
        residentId: 'r9',
        data: { houseId: 'h1', entryDate: '2026-10-01' },
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });
});

describe('censo com foto (decisão 6 e 7)', () => {
  it('copia o arquivo antes de enfileirar e encadeia o upload com o id criado', async () => {
    const queryClient = createClient();
    m.census.addResident.mockResolvedValue({ id: 'r1' });

    await run(queryClient, OUTBOX_MUTATION_KEYS.censusAddResident, {
      houseId: 'h1',
      data: { name: 'Novo' },
      photo: { uri: 'file:///cache/tmp.jpg', type: 'image/jpeg' },
    });

    expect(attachments.persist).toHaveBeenCalledWith('file:///cache/tmp.jpg');
    // A segunda etapa entra na fila com o caminho copiado, não com o uri do picker.
    const chained = queryClient
      .getMutationCache()
      .getAll()
      .find((mutation) => mutation.options.mutationKey?.[1] === 'uploadPhoto');
    expect(chained?.state.variables).toMatchObject({
      residentId: 'r1',
      photoPath: 'file:///doc/outbox/foto.jpg',
      mimeType: 'image/jpeg',
    });
  });

  it('sem foto não enfileira upload nenhum', async () => {
    const queryClient = createClient();

    await run(queryClient, OUTBOX_MUTATION_KEYS.censusAddResident, {
      houseId: 'h1',
      data: { name: 'Novo' },
    });

    expect(attachments.persist).not.toHaveBeenCalled();
    expect(m.residents.uploadPhoto).not.toHaveBeenCalled();
  });

  it('não copia de novo o anexo de um item que já voltou do disco', async () => {
    const queryClient = createClient();

    await run(queryClient, OUTBOX_MUTATION_KEYS.censusAddResident, {
      houseId: 'h1',
      data: { name: 'Novo' },
      photo: { uri: 'file:///cache/tmp.jpg', type: 'image/jpeg' },
      photoPath: 'file:///doc/outbox/antigo.jpg',
    });

    expect(attachments.persist).not.toHaveBeenCalled();
  });

  it('upload remonta o FormData e apaga o arquivo quando o item sai da fila', async () => {
    const queryClient = createClient();

    await run(queryClient, OUTBOX_MUTATION_KEYS.residentUploadPhoto, {
      houseId: 'h1',
      residentId: 'r1',
      photoPath: 'file:///doc/outbox/foto.jpg',
      mimeType: 'image/png',
    });

    expect(attachments.build).toHaveBeenCalledWith('file:///doc/outbox/foto.jpg', {
      type: 'image/png',
    });
    expect(m.residents.uploadPhoto).toHaveBeenCalledWith('r1', 'form-data');
    expect(attachments.discard).toHaveBeenCalledWith('file:///doc/outbox/foto.jpg');
  });

  it('upload rejeitado também limpa o arquivo (o item saiu da fila)', async () => {
    const queryClient = createClient();
    m.residents.uploadPhoto.mockRejectedValue({ response: { status: 413 } });

    await expect(
      run(queryClient, OUTBOX_MUTATION_KEYS.residentUploadPhoto, {
        houseId: 'h1',
        residentId: 'r1',
        photoPath: 'file:///doc/outbox/foto.jpg',
      }),
    ).rejects.toBeDefined();

    expect(attachments.discard).toHaveBeenCalledWith('file:///doc/outbox/foto.jpg');
  });
});

describe('invalidações por chave', () => {
  it.each([
    [
      'census/conclude',
      OUTBOX_MUTATION_KEYS.censusConclude,
      { houseId: 'h1', data: {} },
      queryKeys.residents.byHouse('h1'),
    ],
    [
      'residents/updateStatus',
      OUTBOX_MUTATION_KEYS.residentUpdateStatus,
      { houseId: 'h1', residentId: 'r1', data: {} },
      queryKeys.residents.countByHouse('h1'),
    ],
    [
      'storeroom/createItem',
      OUTBOX_MUTATION_KEYS.storeroomCreateItem,
      { data: { name: 'Arroz' } },
      queryKeys.storeroom.allItems,
    ],
    [
      'supplyRoom/createItem',
      OUTBOX_MUTATION_KEYS.supplyRoomCreateItem,
      { data: { name: 'Sabão' } },
      queryKeys.supplyRoom.allItems,
    ],
    [
      'streetSales/create',
      OUTBOX_MUTATION_KEYS.streetSaleCreate,
      { data: { houseId: 'h1' } },
      queryKeys.streetSales.byHouse('h1'),
    ],
    [
      'streetSales/update',
      OUTBOX_MUTATION_KEYS.streetSaleUpdate,
      { id: 's1', houseId: 'h1', data: {} },
      queryKeys.streetSales.byHouse('h1'),
    ],
    [
      'activities/create',
      OUTBOX_MUTATION_KEYS.activityCreate,
      { data: { title: 'X' } },
      queryKeys.activities.all,
    ],
    [
      'activities/comment',
      OUTBOX_MUTATION_KEYS.activityComment,
      { activityId: 'a1', data: { body: 'oi' } },
      queryKeys.activities.comments('a1'),
    ],
  ])('%s invalida o que a tela mostra', async (_name, key, variables, expectedQueryKey) => {
    const queryClient = createClient();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    await run(queryClient, key, variables);

    expect(invalidate).toHaveBeenCalledWith({ queryKey: expectedQueryKey });
  });

  it('erro definitivo também invalida (a tela volta para a verdade do servidor)', async () => {
    const queryClient = createClient();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    m.activities.create.mockRejectedValue({ response: { status: 403 } });

    await expect(
      run(queryClient, OUTBOX_MUTATION_KEYS.activityCreate, { data: { title: 'X' } }),
    ).rejects.toBeDefined();

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.activities.all });
  });
});

describe('enqueueOutboxMutation', () => {
  it('enfileira fora da árvore React usando o default da chave', async () => {
    const queryClient = createClient();

    enqueueOutboxMutation(queryClient, OUTBOX_MUTATION_KEYS.incidentCreate, {
      data: { houseId: 'h1', description: 'x' },
    } as never);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(m.incidents.create).toHaveBeenCalledWith(
      { houseId: 'h1', description: 'x' },
      idempotent,
    );
  });

  it('falha do item enfileirado não vira rejeição não capturada', async () => {
    const queryClient = createClient();
    m.incidents.create.mockRejectedValue({ response: { status: 500 } });

    expect(() =>
      enqueueOutboxMutation(queryClient, OUTBOX_MUTATION_KEYS.incidentCreate, {
        data: { houseId: 'h1' },
      } as never),
    ).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

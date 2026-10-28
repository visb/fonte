/**
 * Os seis fluxos de campo pela porta da frente (story 171): cada hook que as
 * telas usam é exercitado **sem rede** e depois **com rede**.
 *
 * O que este arquivo trava:
 * - sem sinal o lançamento **pausa** na fila em vez de falhar (nada se perde);
 * - a volta da rede envia o mesmo payload de sempre e invalida as mesmas chaves
 *   — a adaptação ao offline não pode ter afrouxado o comportamento online.
 */
import React, { type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { IncidentType, MovementType, StreetSaleType, SupplyRoomCategory } from '@fonte/types';

jest.mock('@/lib/api', () => ({
  api: {
    census: { addResident: jest.fn(), conclude: jest.fn() },
    residents: { update: jest.fn(), uploadPhoto: jest.fn(), listByHouse: jest.fn() },
    incidents: { create: jest.fn() },
    storeroom: { createMovement: jest.fn(), createItem: jest.fn() },
    supplyRoom: { createMovement: jest.fn(), createItem: jest.fn() },
    streetSales: { create: jest.fn(), update: jest.fn() },
    activities: { create: jest.fn(), addComment: jest.fn() },
  },
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { registerMutationDefaults } from './mutationDefaults';
import { useCensusAddResident } from '@/features/census/hooks/useCensus';
import { useEvadeResident } from '@/features/residents/hooks/useResidentRemoval';
import { useCreateIncident } from '@/features/incidents/hooks/useIncidents';
import { useCreateMovement } from '@/features/storeroom/hooks/useStoreroom';
import { useCreateSupplyItem } from '@/features/supply-room/hooks/useSupplyRoom';
import { useCreateStreetSale } from '@/features/street-sales/hooks/useStreetSales';
import { useAddComment } from '@/features/activities/hooks/useActivities';

const m = api as unknown as Record<string, Record<string, jest.Mock>>;

/** Erro de rede do axios: sem `response`, que é o que distingue rede de rejeição. */
function networkError(): Error {
  return new Error('Network Error');
}

function createClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { gcTime: Infinity },
    },
  });
  // Política real (rede repete para sempre), sem espera entre tentativas.
  registerMutationDefaults(client, { retryDelay: 1 });
  return client;
}

interface FieldFlow {
  name: string;
  useHook: () => { mutate: (input: never) => void };
  input: unknown;
  call: () => jest.Mock;
  /** Payload esperado no envio, sem o `RequestOptions` da idempotência. */
  payload: unknown[];
  invalidates: readonly unknown[];
}

const flows: FieldFlow[] = [
  {
    name: 'censo — adicionar filho',
    useHook: () => useCensusAddResident('h1'),
    input: { data: { name: 'Novo', houseId: 'h1' } },
    call: () => m.census.addResident,
    payload: [{ name: 'Novo', houseId: 'h1' }],
    invalidates: queryKeys.residents.byHouse('h1'),
  },
  {
    name: 'censo — evasão',
    useHook: () => useEvadeResident('h1'),
    input: { residentId: 'r1', exitDate: '2026-08-10' },
    call: () => m.residents.update,
    payload: ['r1', { status: 'EVADED', exitDate: '2026-08-10' }],
    invalidates: queryKeys.residents.countByHouse('h1'),
  },
  {
    name: 'ocorrência',
    useHook: () => useCreateIncident(),
    input: {
      date: '2026-08-10',
      type: IncidentType.NEGATIVE,
      description: 'briga',
      houseId: 'h1',
      responsibleId: 'staff-1',
      residentIds: [],
    },
    call: () => m.incidents.create,
    payload: [
      {
        date: '2026-08-10',
        type: IncidentType.NEGATIVE,
        description: 'briga',
        houseId: 'h1',
        responsibleId: 'staff-1',
        residentIds: [],
      },
    ],
    invalidates: queryKeys.incidents.all,
  },
  {
    name: 'dispensa — movimentação',
    useHook: () => useCreateMovement(),
    input: {
      itemId: 'i1',
      type: MovementType.OUT,
      quantity: 2,
      responsibleId: 'staff-1',
      date: '2026-08-10',
      notes: null,
    },
    call: () => m.storeroom.createMovement,
    payload: [
      {
        itemId: 'i1',
        type: MovementType.OUT,
        quantity: 2,
        responsibleId: 'staff-1',
        date: '2026-08-10',
        notes: null,
      },
    ],
    invalidates: queryKeys.storeroom.allItems,
  },
  {
    name: 'almoxarifado — novo item',
    useHook: () => useCreateSupplyItem(),
    input: {
      name: 'Sabão',
      unit: 'un',
      category: SupplyRoomCategory.CLEANING,
      houseId: 'h1',
    },
    call: () => m.supplyRoom.createItem,
    payload: [
      { name: 'Sabão', unit: 'un', category: SupplyRoomCategory.CLEANING, houseId: 'h1' },
    ],
    invalidates: queryKeys.supplyRoom.allItems,
  },
  {
    name: 'venda de rua',
    useHook: () => useCreateStreetSale(),
    input: {
      houseId: 'h1',
      date: '2026-08-10',
      type: StreetSaleType.BREAD,
      quantity: 10,
      amountPix: 1000,
      amountCash: 0,
      amountCard: 0,
    },
    call: () => m.streetSales.create,
    payload: [
      {
        houseId: 'h1',
        date: '2026-08-10',
        type: StreetSaleType.BREAD,
        quantity: 10,
        amountPix: 1000,
        amountCash: 0,
        amountCard: 0,
      },
    ],
    invalidates: queryKeys.streetSales.byHouse('h1'),
  },
  {
    name: 'atividade — comentário',
    useHook: () => useAddComment('a1'),
    input: { body: 'combinado' },
    call: () => m.activities.addComment,
    payload: ['a1', { body: 'combinado' }],
    invalidates: queryKeys.activities.comments('a1'),
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  onlineManager.setOnline(true);
});

afterAll(() => onlineManager.setOnline(true));

describe.each(flows)('$name', ({ useHook, input, call, payload, invalidates }) => {
  function render(client: QueryClient) {
    return renderHook(() => useHook(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
  }

  it('sem rede o lançamento pausa na fila em vez de falhar', async () => {
    const client = createClient();
    onlineManager.setOnline(false);
    call().mockRejectedValue(networkError());
    const { result } = render(client);

    result.current.mutate(input as never);

    await waitFor(() =>
      expect(client.getMutationCache().getAll()[0]?.state.isPaused).toBe(true),
    );
    // Continua na fila: o operador não perde o que lançou.
    expect(client.getMutationCache().getAll()).toHaveLength(1);
  });

  it('a volta da rede envia o mesmo payload e invalida as mesmas chaves', async () => {
    const client = createClient();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    onlineManager.setOnline(false);
    call().mockRejectedValue(networkError());
    const { result } = render(client);
    result.current.mutate(input as never);
    await waitFor(() =>
      expect(client.getMutationCache().getAll()[0]?.state.isPaused).toBe(true),
    );

    call().mockResolvedValue({ id: 'criado' });
    onlineManager.setOnline(true);
    await client.resumePausedMutations();

    expect(call()).toHaveBeenLastCalledWith(
      ...payload,
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: invalidates }));
  });
});

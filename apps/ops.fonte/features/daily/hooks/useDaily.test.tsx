import { Alert } from 'react-native';
import { act, waitFor } from '@testing-library/react-native';
import { DailyPersonType, type DailyBoard } from '@fonte/types';

jest.mock('@/lib/api', () => ({
  api: { daily: { current: jest.fn(), move: jest.fn(), apply: jest.fn(), start: jest.fn() } },
  resolveAssetUrl: (u: string | null) => u,
}));

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { createTestQueryClient, renderHookWithClient } from '@/lib/test/utils';
import { makeBoard } from '@/lib/test/__mocks__/dailyBoardFixture';
import { useApplyDaily, useDailyBoard, useMoveDailyPerson, useStartDaily } from './useDaily';

const daily = (api as unknown as { daily: Record<string, jest.Mock> }).daily;
const key = queryKeys.daily.board('h1');
const R = DailyPersonType.RESIDENT;

/** Client de teste com o board sem GC (o default de teste é gcTime 0). */
function boardClient() {
  const client = createTestQueryClient();
  client.setQueryDefaults(key, { gcTime: Infinity });
  return client;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

describe('useDailyBoard', () => {
  it('busca a daily da casa', async () => {
    daily.current.mockResolvedValue(makeBoard());
    const { result } = renderHookWithClient(() => useDailyBoard('h1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(daily.current).toHaveBeenCalledWith('h1');
  });

  it('sem casa não busca', () => {
    renderHookWithClient(() => useDailyBoard(null));
    expect(daily.current).not.toHaveBeenCalled();
  });
});

describe('useMoveDailyPerson', () => {
  const input = { personType: R, personId: 'r2', toMinistryId: 'm1' };

  it('update otimista e version do servidor no sucesso', async () => {
    const client = boardClient();
    client.setQueryData(key, makeBoard());
    let resolve!: (v: { version: number }) => void;
    daily.move.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result } = renderHookWithClient(() => useMoveDailyPerson('h1'), client);

    act(() => result.current.mutate({ sessionId: 'sess-1', input }));
    await waitFor(() =>
      expect(client.getQueryData<DailyBoard>(key)!.ministries[0].members.map((p) => p.id)).toContain('r2'),
    );
    expect(daily.move).toHaveBeenCalledWith('sess-1', input);

    await act(async () => resolve({ version: 4 }));
    await waitFor(() => expect(client.getQueryData<DailyBoard>(key)!.session.version).toBe(4));
  });

  it('erro → rollback + aviso com a mensagem do backend', async () => {
    const client = boardClient();
    const original = makeBoard();
    client.setQueryData(key, original);
    daily.move.mockRejectedValue({ response: { data: { message: 'Esta daily já foi encerrada.' } } });
    daily.current.mockResolvedValue(original);
    const { result } = renderHookWithClient(() => useMoveDailyPerson('h1'), client);

    act(() => result.current.mutate({ sessionId: 'sess-1', input }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData<DailyBoard>(key)!.unassigned.map((p) => p.id)).toContain('r2');
    expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Esta daily já foi encerrada.');
  });

  it('sem board no cache: só chama a API', async () => {
    daily.move.mockResolvedValue({ version: 1 });
    const { result, } = renderHookWithClient(() => useMoveDailyPerson('h1'));
    act(() => result.current.mutate({ sessionId: 'sess-1', input }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useApplyDaily', () => {
  it('aplica, devolve os pulados com nome e invalida ministérios/servos/filhos', async () => {
    const client = boardClient();
    client.setQueryData(key, makeBoard());
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    daily.apply.mockResolvedValue({ applied: 2, skipped: [{ personType: R, personId: 'r1', reason: 'saiu' }] });
    daily.current.mockResolvedValue(makeBoard());
    const { result } = renderHookWithClient(() => useApplyDaily('h1'), client);

    act(() => result.current.mutate('sess-1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(daily.apply).toHaveBeenCalledWith('sess-1');
    expect(result.current.data?.skippedPeople).toEqual([{ key: 'RESIDENT:r1', name: 'Bruno', reason: 'saiu' }]);
    const keys = invalidate.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(keys).toEqual(expect.arrayContaining([
      JSON.stringify(key),
      JSON.stringify(queryKeys.ministries.byHouse('h1')),
      JSON.stringify(queryKeys.ministries.details),
      JSON.stringify(queryKeys.houses.ministries('h1')),
      JSON.stringify(queryKeys.staff.byHouse('h1')),
      JSON.stringify(queryKeys.residents.byHouse('h1')),
    ]));
  });

  it('erro → aviso e refetch do board', async () => {
    daily.apply.mockRejectedValue(new Error('x'));
    const { result } = renderHookWithClient(() => useApplyDaily('h1'));
    act(() => result.current.mutate('sess-1'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Não foi possível aplicar a daily.');
  });
});

describe('useStartDaily', () => {
  it('nova daily entra direto no cache', async () => {
    const client = boardClient();
    const next = makeBoard({ id: 'sess-2' });
    daily.start.mockResolvedValue(next);
    const { result } = renderHookWithClient(() => useStartDaily('h1'), client);
    act(() => result.current.mutate());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(daily.start).toHaveBeenCalledWith('h1');
    expect(client.getQueryData<DailyBoard>(key)!.session.id).toBe('sess-2');
  });

  it('erro → aviso', async () => {
    daily.start.mockRejectedValue(new Error('x'));
    const { result } = renderHookWithClient(() => useStartDaily('h1'));
    act(() => result.current.mutate());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Não foi possível abrir uma nova daily.');
  });
});

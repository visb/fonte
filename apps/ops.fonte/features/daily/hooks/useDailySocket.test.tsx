import { AppState } from 'react-native';
import { act, waitFor } from '@testing-library/react-native';
import { DailyPersonType, DailySessionStatus, type DailyBoard } from '@fonte/types';

type Handler = (payload?: unknown) => void;
const handlers: Record<string, Handler> = {};
const mockSocket = {
  on: jest.fn((event: string, fn: Handler) => {
    handlers[event] = fn;
  }),
  off: jest.fn(),
  emit: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  connected: true,
};
const mockIo = jest.fn((..._args: unknown[]) => mockSocket);
jest.mock('socket.io-client', () => ({ io: (...a: unknown[]) => mockIo(...a) }));
jest.mock('@/lib/api', () => ({ apiOrigin: 'http://localhost:3000', api: {} }));
const mockUseAuth = jest.fn();
jest.mock('@/lib/auth', () => ({ useAuth: () => mockUseAuth() }));

import { queryKeys } from '@/lib/queryKeys';
import { createTestQueryClient, renderHookWithClient } from '@/lib/test/utils';
import { makeBoard } from '@/lib/test/__mocks__/dailyBoardFixture';
import { useDailySocket } from './useDailySocket';

const key = queryKeys.daily.board('h1');
const moved = (version: number, extra: Record<string, unknown> = {}) => ({
  sessionId: 'sess-1', personType: DailyPersonType.RESIDENT, personId: 'r2', toMinistryId: 'm2',
  version, movedByUserId: 'u2', ...extra,
});

let appStateListener: ((s: string) => void) | null = null;
const removeSub = jest.fn();

function setup(board: DailyBoard | null = makeBoard()) {
  const client = createTestQueryClient();
  client.setQueryDefaults(key, { gcTime: Infinity });
  if (board) client.setQueryData(key, board);
  const invalidate = jest.spyOn(client, 'invalidateQueries').mockResolvedValue();
  const hook = renderHookWithClient(() => useDailySocket('h1', 'sess-1'), client);
  return { client, invalidate, ...hook };
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(handlers).forEach((k) => delete handlers[k]);
  mockSocket.connected = true;
  mockUseAuth.mockReturnValue({ token: 'jwt' });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, fn) => {
    appStateListener = fn as (s: string) => void;
    return { remove: removeSub } as never;
  });
});

describe('useDailySocket', () => {
  it('sem token ou sem sessão não abre socket', () => {
    mockUseAuth.mockReturnValue({ token: null });
    renderHookWithClient(() => useDailySocket('h1', 'sess-1'));
    mockUseAuth.mockReturnValue({ token: 'jwt' });
    renderHookWithClient(() => useDailySocket('h1', undefined));
    expect(mockIo).not.toHaveBeenCalled();
  });

  it('conecta em /daily e entra na room da sessão; reconexão → join de novo + GET', async () => {
    const { invalidate } = setup();
    await waitFor(() => expect(mockIo).toHaveBeenCalledWith('http://localhost:3000/daily', expect.objectContaining({
      transports: ['websocket'], auth: { token: 'jwt' },
    })));
    act(() => handlers.connect());
    expect(mockSocket.emit).toHaveBeenCalledWith('daily:join', { sessionId: 'sess-1' });
    expect(invalidate).not.toHaveBeenCalled();
    act(() => handlers.connect());
    expect(mockSocket.emit).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: key });
  });

  it('daily:moved atualiza o cache e a version; expõe o último movimento remoto', async () => {
    const { client, result } = setup();
    await waitFor(() => expect(handlers['daily:moved']).toBeDefined());
    act(() => handlers['daily:moved'](moved(1)));
    const board = client.getQueryData<DailyBoard>(key)!;
    expect(board.ministries[1].members.map((p) => p.id)).toContain('r2');
    expect(board.session.version).toBe(1);
    expect(result.current.lastRemoteMove).toMatchObject({ personId: 'r2' });
  });

  it('salto de version → GET completo, sem aplicar', async () => {
    const { client, invalidate } = setup();
    await waitFor(() => expect(handlers['daily:moved']).toBeDefined());
    act(() => handlers['daily:moved'](moved(3)));
    expect(client.getQueryData<DailyBoard>(key)!.unassigned.map((p) => p.id)).toContain('r2');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: key });
  });

  it('evento velho (o próprio) ou de outra sessão é ignorado; sem board no cache não quebra', async () => {
    const { client, invalidate } = setup(makeBoard({ version: 2 }));
    await waitFor(() => expect(handlers['daily:moved']).toBeDefined());
    act(() => handlers['daily:moved'](moved(2)));
    act(() => handlers['daily:moved'](moved(3, { sessionId: 'other' })));
    expect(client.getQueryData<DailyBoard>(key)!.session.version).toBe(2);
    expect(invalidate).not.toHaveBeenCalled();
    client.removeQueries({ queryKey: key });
    expect(() => act(() => handlers['daily:moved'](moved(3)))).not.toThrow();
  });

  it('daily:applied → board somente leitura', async () => {
    const { client } = setup();
    await waitFor(() => expect(handlers['daily:applied']).toBeDefined());
    act(() => handlers['daily:applied']({
      sessionId: 'sess-1', appliedAt: '2026-10-27T15:00:00Z', appliedByUserId: 'u2', appliedByName: 'Outro',
      result: { applied: 1, skipped: [] },
    }));
    expect(client.getQueryData<DailyBoard>(key)!.session.status).toBe(DailySessionStatus.APPLIED);
    client.removeQueries({ queryKey: key });
    expect(() => act(() => handlers['daily:applied']({ sessionId: 'sess-1' }))).not.toThrow();
  });

  it('daily:reset → GET; daily:error → aviso (limpo ao reconectar)', async () => {
    const { invalidate, result } = setup();
    await waitFor(() => expect(handlers['daily:reset']).toBeDefined());
    act(() => handlers['daily:reset']());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: key });
    act(() => handlers['daily:error']({ message: 'Sem acesso a esta daily.' }));
    expect(result.current.error).toBe('Sem acesso a esta daily.');
    act(() => handlers['daily:error'](undefined));
    expect(result.current.error).toBe('Erro na daily.');
    act(() => handlers.connect());
    expect(result.current.error).toBeNull();
  });

  it('volta do background: reconecta se caiu e refaz o GET', async () => {
    const { invalidate } = setup();
    await waitFor(() => expect(handlers.connect).toBeDefined());
    act(() => appStateListener?.('background'));
    expect(invalidate).not.toHaveBeenCalled();
    mockSocket.connected = false;
    act(() => appStateListener?.('active'));
    expect(mockSocket.connect).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: key });
  });

  it('desmontar desconecta e remove o listener', async () => {
    const { unmount } = setup();
    await waitFor(() => expect(mockIo).toHaveBeenCalled());
    unmount();
    expect(mockSocket.off).toHaveBeenCalled();
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(removeSub).toHaveBeenCalled();
  });

  it('desmontar antes de o token ser lido não abre socket', async () => {
    const { unmount } = setup();
    unmount();
    await new Promise((r) => setTimeout(r, 0));
    expect(mockIo).not.toHaveBeenCalled();
  });
});

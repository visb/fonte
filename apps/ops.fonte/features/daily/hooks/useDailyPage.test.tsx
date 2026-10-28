import { act, renderHook } from '@testing-library/react-native';
import { DailySessionStatus } from '@fonte/types';
import { makeBoard, resident } from '@/lib/test/__mocks__/dailyBoardFixture';

const mockBoardQuery = { data: undefined as unknown, isLoading: false, error: null, refetch: jest.fn() };
const mockMove = { mutate: jest.fn() };
const mockApply = { mutate: jest.fn(), isPending: false, data: undefined as unknown, variables: undefined as unknown };
const mockStart = { mutate: jest.fn(), isPending: false };
const mockSocket = { error: null as string | null, lastRemoteMove: null };
let mockOnline = true;

jest.mock('./useDaily', () => ({
  useDailyBoard: () => mockBoardQuery,
  useMoveDailyPerson: () => mockMove,
  useApplyDaily: () => mockApply,
  useStartDaily: () => mockStart,
}));
jest.mock('./useDailySocket', () => ({ useDailySocket: () => mockSocket }));
jest.mock('@/lib/offline/network', () => ({ useIsOnline: () => mockOnline }));

import { useDailyPage } from './useDailyPage';

const ana = resident('r2', 'Ana');

beforeEach(() => {
  jest.clearAllMocks();
  mockOnline = true;
  mockBoardQuery.data = makeBoard();
  mockApply.data = undefined;
  mockApply.variables = undefined;
});

describe('useDailyPage', () => {
  it('board aberto e online: editável, com a contagem de mudanças', () => {
    const { result } = renderHook(() => useDailyPage('h1'));
    expect(result.current.disabled).toBe(false);
    expect(result.current.readOnly).toBe(false);
    expect(result.current.changes).toBe(1);
  });

  it('tocar abre o sheet; escolher dispara o move e fecha', () => {
    const { result } = renderHook(() => useDailyPage('h1'));
    act(() => result.current.openSheet(ana));
    expect(result.current.sheetPerson?.id).toBe('r2');
    expect(result.current.sheetCurrentBox).toBeNull();
    act(() => result.current.movePerson(ana, 'm1'));
    expect(mockMove.mutate).toHaveBeenCalledWith({
      sessionId: 'sess-1', input: { personType: 'RESIDENT', personId: 'r2', toMinistryId: 'm1' },
    });
    expect(result.current.sheetPerson).toBeNull();
    act(() => result.current.closeSheet());
  });

  it('offline: tudo desabilitado — nem sheet nem move', () => {
    mockOnline = false;
    const { result } = renderHook(() => useDailyPage('h1'));
    expect(result.current.disabled).toBe(true);
    act(() => result.current.openSheet(ana));
    expect(result.current.sheetPerson).toBeNull();
    act(() => result.current.movePerson(ana, 'm1'));
    expect(mockMove.mutate).not.toHaveBeenCalled();
  });

  it('sessão aplicada: somente leitura', () => {
    mockBoardQuery.data = makeBoard({ status: DailySessionStatus.APPLIED });
    const { result } = renderHook(() => useDailyPage('h1'));
    expect(result.current.readOnly).toBe(true);
    expect(result.current.disabled).toBe(true);
  });

  it('sem board: somente leitura, sem contagem; apply é no-op', () => {
    mockBoardQuery.data = undefined;
    const { result } = renderHook(() => useDailyPage(undefined));
    expect(result.current.readOnly).toBe(true);
    expect(result.current.changes).toBe(0);
    act(() => {
      result.current.apply();
    });
    expect(mockApply.mutate).not.toHaveBeenCalled();
  });

  it('apply e nova daily', () => {
    const { result } = renderHook(() => useDailyPage('h1'));
    act(() => {
      result.current.apply();
    });
    expect(mockApply.mutate).toHaveBeenCalledWith('sess-1');
    act(() => result.current.startNew());
    expect(mockStart.mutate).toHaveBeenCalled();
  });

  it('pulados só aparecem para o board onde o apply foi feito', () => {
    mockApply.data = { applied: 1, skipped: [], skippedPeople: [{ key: 'k', name: 'Bruno', reason: 'saiu' }] };
    mockApply.variables = 'sess-1';
    const { result, rerender } = renderHook(() => useDailyPage('h1'));
    expect(result.current.skipped).toHaveLength(1);
    mockApply.variables = 'other';
    rerender({});
    expect(result.current.skipped).toEqual([]);
  });
});

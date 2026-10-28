import { Vibration } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { resident } from '@/lib/test/__mocks__/dailyBoardFixture';
import { UNASSIGNED_KEY } from '../constants';
import { useDailyDrag } from './useDailyDrag';

const ana = resident('r2', 'Ana');

function setup(viewport = { y: 100, height: 600 }) {
  const measureInWindow = jest.fn((cb: (x: number, y: number, w: number, h: number) => void) =>
    cb(0, viewport.y, 400, viewport.height));
  const containerRef = { current: { measureInWindow } } as never;
  const scrollTo = jest.fn();
  const scrollRef = { current: { scrollTo } };
  const onDrop = jest.fn();
  const boxOf = jest.fn(() => UNASSIGNED_KEY);
  const hook = renderHook(() => useDailyDrag({ containerRef, scrollRef, onDrop, boxOf }));
  // Caixas no conteúdo do scroll: Sem ministério 0–200, m1 210–610, m2 620–1100.
  act(() => {
    hook.result.current.onBoxLayout(UNASSIGNED_KEY, 0, 200);
    hook.result.current.onBoxLayout('m1', 210, 400);
    hook.result.current.onBoxLayout('m2', 620, 480);
    hook.result.current.onContentSizeChange(400, 1100);
  });
  return { ...hook, onDrop, scrollTo, measureInWindow };
}

beforeEach(() => {
  jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
});

describe('useDailyDrag', () => {
  it('long-press → flutua (háptico) → hover na caixa → solta → move', () => {
    const { result, onDrop } = setup();
    act(() => result.current.handlers.onDragStart(ana, 50, 150));
    expect(Vibration.vibrate).toHaveBeenCalled();
    expect(result.current.dragging?.person.id).toBe('r2');
    expect(result.current.draggingKey).toBe('RESIDENT:r2');
    expect(result.current.hoverKey).toBe(UNASSIGNED_KEY);

    act(() => result.current.handlers.onDragMove(50, 500)); // conteúdo y = 400 → m1
    expect(result.current.hoverKey).toBe('m1');
    act(() => result.current.handlers.onDragEnd());
    expect(onDrop).toHaveBeenCalledWith(ana, 'm1');
    expect(result.current.dragging).toBeNull();
    expect(result.current.hoverKey).toBeNull();
  });

  it('soltar na própria caixa ou fora de caixa → não move', () => {
    const { result, onDrop } = setup();
    act(() => result.current.handlers.onDragStart(ana, 50, 150));
    act(() => result.current.handlers.onDragEnd());
    act(() => result.current.handlers.onDragStart(ana, 50, 150));
    act(() => result.current.handlers.onDragMove(50, 305)); // conteúdo 205: entre caixas
    expect(result.current.hoverKey).toBeNull();
    act(() => result.current.handlers.onDragEnd());
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('cancelar (gesto falhou) não move', () => {
    const { result, onDrop } = setup();
    act(() => result.current.handlers.onDragStart(ana, 50, 150));
    act(() => result.current.handlers.onDragMove(50, 500));
    act(() => result.current.handlers.onDragCancel());
    expect(result.current.dragging).toBeNull();
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('movimento remoto da mesma pessoa cancela o arrasto local; de outra, não', () => {
    const { result, onDrop } = setup();
    act(() => result.current.handlers.onDragStart(ana, 50, 150));
    act(() => result.current.cancelFor('RESIDENT:outra'));
    expect(result.current.dragging).not.toBeNull();
    act(() => result.current.cancelFor('RESIDENT:r2'));
    expect(result.current.dragging).toBeNull();
    act(() => result.current.handlers.onDragEnd());
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('move sem arrasto ativo é ignorado', () => {
    const { result } = setup();
    act(() => result.current.handlers.onDragMove(50, 500));
    expect(result.current.hoverKey).toBeNull();
  });

  it('auto-scroll na borda de baixo desce até o fim e para; scroll manual atualiza o offset', () => {
    jest.useFakeTimers();
    const { result, scrollTo } = setup();
    act(() => result.current.handlers.onDragStart(ana, 50, 150));
    act(() => result.current.handlers.onDragMove(50, 690)); // 590 de 600 → borda
    act(() => result.current.handlers.onDragMove(50, 695)); // timer já ativo
    act(() => jest.advanceTimersByTime(16 * 40));
    expect(scrollTo).toHaveBeenCalled();
    const lastY = scrollTo.mock.calls[scrollTo.mock.calls.length - 1][0].y;
    expect(lastY).toBe(500); // conteúdo 1100 - viewport 600
    expect(result.current.hoverKey).toBe('m2');
    const calls = scrollTo.mock.calls.length;
    act(() => jest.advanceTimersByTime(16 * 5));
    expect(scrollTo.mock.calls.length).toBe(calls); // parou no limite

    act(() => result.current.handlers.onDragMove(50, 400)); // meio → para
    act(() => result.current.handlers.onDragEnd());
    act(() => result.current.onScroll({ nativeEvent: { contentOffset: { y: 0 } } } as never));
    jest.useRealTimers();
  });

  it('auto-scroll para quando o dedo sai da borda durante o timer', () => {
    jest.useFakeTimers();
    const { result, scrollTo } = setup();
    act(() => result.current.handlers.onDragStart(ana, 50, 150));
    act(() => result.current.handlers.onDragMove(50, 690));
    act(() => jest.advanceTimersByTime(16));
    const before = scrollTo.mock.calls.length;
    // Dedo volta para o meio: o auto-scroll para.
    act(() => result.current.handlers.onDragMove(50, 400));
    act(() => jest.advanceTimersByTime(16 * 3));
    expect(scrollTo.mock.calls.length).toBe(before);
    jest.useRealTimers();
  });
});

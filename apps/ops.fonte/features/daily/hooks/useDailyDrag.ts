import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Animated, Vibration, type NativeScrollEvent, type NativeSyntheticEvent, type View } from 'react-native';
import type { DailyPerson } from '@fonte/types';
import { autoScrollDelta, findDropTarget, ministryIdOfKey, personKey, type BoxLayout } from '../lib/dailyBoard';

interface Scrollable {
  scrollTo: (opts: { y: number; animated: boolean }) => void;
}

interface Options {
  /** Container que envolve o scroll (viewport do board). */
  containerRef: RefObject<View | null>;
  scrollRef: RefObject<Scrollable | null>;
  /** Pessoa da caixa `fromKey` solta numa caixa diferente. */
  onDrop: (person: DailyPerson, toMinistryId: string | null) => void;
  /** Caixa atual da pessoa (chave de layout). */
  boxOf: (person: DailyPerson) => string;
}

interface Viewport {
  y: number;
  height: number;
}

const FLOAT_OFFSET = 28;
const FRAME_MS = 16;

/**
 * Camada de drag do board (decisão 12), sem React no meio do gesto: posição do
 * card flutuante num `Animated.Value`, hover/auto-scroll calculados pelas
 * funções puras de `dailyBoard`. Estado só muda quando a caixa sob o dedo muda.
 */
export function useDailyDrag({ containerRef, scrollRef, onDrop, boxOf }: Options) {
  const [dragging, setDragging] = useState<{ person: DailyPerson; fromKey: string } | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const floatY = useRef(new Animated.Value(0)).current;
  const layouts = useRef(new Map<string, BoxLayout>());
  const viewport = useRef<Viewport | null>(null);
  const scrollY = useRef(0);
  const contentHeight = useRef(0);
  const fingerY = useRef(0);
  const hoverRef = useRef<string | null>(null);
  const draggingRef = useRef<{ person: DailyPerson; fromKey: string } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAutoScroll = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const updateHover = useCallback(() => {
    const vp = viewport.current;
    if (!vp) return;
    const key = findDropTarget([...layouts.current.values()], fingerY.current - vp.y + scrollY.current) ?? null;
    if (key !== hoverRef.current) {
      hoverRef.current = key;
      setHoverKey(key);
    }
  }, []);

  const reset = useCallback(() => {
    stopAutoScroll();
    draggingRef.current = null;
    hoverRef.current = null;
    setDragging(null);
    setHoverKey(null);
  }, []);

  const onDragStart = useCallback((person: DailyPerson, _x: number, absoluteY: number) => {
    const state = { person, fromKey: boxOf(person) };
    draggingRef.current = state;
    fingerY.current = absoluteY;
    setDragging(state);
    Vibration.vibrate(15);
    containerRef.current?.measureInWindow((_vx, vy, _w, height) => {
      viewport.current = { y: vy, height };
      floatY.setValue(absoluteY - vy - FLOAT_OFFSET);
      updateHover();
    });
  }, [boxOf, containerRef, floatY, updateHover]);

  const onDragMove = useCallback((_x: number, absoluteY: number) => {
    const vp = viewport.current;
    if (!draggingRef.current || !vp) return;
    fingerY.current = absoluteY;
    floatY.setValue(absoluteY - vp.y - FLOAT_OFFSET);
    updateHover();
    const delta = autoScrollDelta(absoluteY - vp.y, vp.height);
    if (delta === 0) return stopAutoScroll();
    if (timer.current) return;
    timer.current = setInterval(() => {
      const step = autoScrollDelta(fingerY.current - vp.y, vp.height);
      const max = Math.max(contentHeight.current - vp.height, 0);
      const next = Math.min(Math.max(scrollY.current + step, 0), max);
      // Dedo saiu da borda (passo 0) ou chegou no limite do conteúdo.
      if (next === scrollY.current) return stopAutoScroll();
      scrollY.current = next;
      scrollRef.current?.scrollTo({ y: next, animated: false });
      updateHover();
    }, FRAME_MS);
  }, [floatY, scrollRef, updateHover]);

  const onDragEnd = useCallback(() => {
    const state = draggingRef.current;
    const target = hoverRef.current;
    reset();
    if (state && target && target !== state.fromKey) onDrop(state.person, ministryIdOfKey(target));
  }, [onDrop, reset]);

  /** Movimento remoto da pessoa que estou arrastando: o remoto vence (decisão 7). */
  const cancelFor = useCallback((key: string) => {
    if (draggingRef.current && personKey(draggingRef.current.person) === key) reset();
  }, [reset]);

  const onBoxLayout = useCallback((key: string, y: number, height: number) => {
    layouts.current.set(key, { key, y, height });
  }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
  }, []);

  const onContentSizeChange = useCallback((_w: number, h: number) => {
    contentHeight.current = h;
  }, []);

  useEffect(() => stopAutoScroll, []);

  return {
    dragging,
    draggingKey: dragging ? personKey(dragging.person) : null,
    hoverKey,
    floatY,
    handlers: { onDragStart, onDragMove, onDragEnd, onDragCancel: reset },
    cancelFor,
    onBoxLayout,
    onScroll,
    onContentSizeChange,
  };
}

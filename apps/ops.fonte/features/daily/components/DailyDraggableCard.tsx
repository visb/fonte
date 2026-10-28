import { useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { DailyPerson } from '@fonte/types';
import { DAILY_LONG_PRESS_MS } from '../constants';
import { DailyPersonCard } from './DailyPersonCard';

export interface DailyDragHandlers {
  onDragStart: (person: DailyPerson, absoluteX: number, absoluteY: number) => void;
  onDragMove: (absoluteX: number, absoluteY: number) => void;
  onDragEnd: () => void;
  onDragCancel: () => void;
}

interface Props extends DailyDragHandlers {
  person: DailyPerson;
  /** Sem rede ou sessão encerrada: nem arrasto nem toque (decisão 11). */
  disabled: boolean;
  /** Toque simples → sheet "Mover para…" (caminho acessível/determinístico). */
  onPress: (person: DailyPerson) => void;
  /** Card que está flutuando: o original fica esmaecido no lugar. */
  isDragging: boolean;
}

/**
 * Card arrastável (decisão 12): long-press (~300ms) ativa o pan e o card
 * flutua; toque simples abre o "Mover para…". Os callbacks rodam no JS
 * (`runOnJS`) — a camada de drag do `DailyBoard` decide hover e drop.
 */
export function DailyDraggableCard({
  person, disabled, onPress, isDragging, onDragStart, onDragMove, onDragEnd, onDragCancel,
}: Props) {
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .enabled(!disabled)
      .activateAfterLongPress(DAILY_LONG_PRESS_MS)
      .onStart((e: { absoluteX: number; absoluteY: number }) => onDragStart(person, e.absoluteX, e.absoluteY))
      .onUpdate((e: { absoluteX: number; absoluteY: number }) => onDragMove(e.absoluteX, e.absoluteY))
      .onEnd(() => onDragEnd())
      .onFinalize((_e: unknown, success: boolean) => {
        if (!success) onDragCancel();
      });
    const tap = Gesture.Tap()
      .runOnJS(true)
      .enabled(!disabled)
      .onEnd((_e: unknown, success: boolean) => {
        if (success) onPress(person);
      });
    return Gesture.Exclusive(pan, tap);
  }, [person, disabled, onPress, onDragStart, onDragMove, onDragEnd, onDragCancel]);

  return (
    <GestureDetector gesture={gesture}>
      <View
        testID={`daily-card-${person.id}`}
        accessibilityRole="button"
        accessibilityLabel={person.name}
        accessibilityState={{ disabled }}
        style={{ opacity: isDragging ? 0.35 : 1 }}
      >
        <DailyPersonCard person={person} />
      </View>
    </GestureDetector>
  );
}

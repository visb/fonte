import { useCallback, useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import type { DailyBoard as DailyBoardData, DailyMovedEvent, DailyPerson } from '@fonte/types';
import { DAILY_LABELS, UNASSIGNED_KEY } from '../constants';
import { boxKey, findPersonBox, personKey } from '../lib/dailyBoard';
import { useDailyDrag } from '../hooks/useDailyDrag';
import { DailyMinistryBox } from './DailyMinistryBox';
import { DailyPersonCard } from './DailyPersonCard';

interface Props {
  board: DailyBoardData;
  /** Sem rede ou sessão encerrada: somente leitura. */
  disabled: boolean;
  onMove: (person: DailyPerson, toMinistryId: string | null) => void;
  onPressPerson: (person: DailyPerson) => void;
  /** Último movimento remoto — cancela o arrasto local da mesma pessoa. */
  lastRemoteMove: DailyMovedEvent | null;
}

/**
 * Board da daily (decisão 12): caixas empilhadas na vertical, "Sem ministério"
 * no topo; arrastar (long-press) entre caixas com auto-scroll nas bordas.
 */
export function DailyBoard({ board, disabled, onMove, onPressPerson, lastRemoteMove }: Props) {
  const containerRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const boxOf = useCallback(
    (person: DailyPerson) => boxKey(findPersonBox(board, person.type, person.id) ?? null),
    [board],
  );
  const drag = useDailyDrag({ containerRef, scrollRef, onDrop: onMove, boxOf });
  const { cancelFor } = drag;

  useEffect(() => {
    if (lastRemoteMove) cancelFor(personKey({ type: lastRemoteMove.personType, id: lastRemoteMove.personId }));
  }, [lastRemoteMove, cancelFor]);

  const boxProps = {
    disabled,
    draggingKey: drag.draggingKey,
    onPressPerson,
    onBoxLayout: drag.onBoxLayout,
    ...drag.handlers,
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View ref={containerRef} className="flex-1" collapsable={false}>
        <ScrollView
          ref={scrollRef}
          testID="daily-board-scroll"
          scrollEnabled={!drag.dragging}
          onScroll={drag.onScroll}
          onContentSizeChange={drag.onContentSizeChange}
          scrollEventThrottle={16}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        >
          <DailyMinistryBox
            boxKey={UNASSIGNED_KEY}
            title={DAILY_LABELS.unassigned}
            members={board.unassigned}
            isOver={drag.hoverKey === UNASSIGNED_KEY}
            {...boxProps}
          />
          {board.ministries.map((ministry) => (
            <DailyMinistryBox
              key={ministry.id}
              boxKey={ministry.id}
              title={ministry.name}
              members={ministry.members}
              isOver={drag.hoverKey === ministry.id}
              {...boxProps}
            />
          ))}
        </ScrollView>
        {drag.dragging ? (
          <Animated.View
            testID="daily-floating-card"
            pointerEvents="none"
            style={{ position: 'absolute', left: 16, right: 16, top: 0, transform: [{ translateY: drag.floatY }] }}
          >
            <DailyPersonCard person={drag.dragging.person} floating />
          </Animated.View>
        ) : null}
      </View>
    </GestureHandlerRootView>
  );
}

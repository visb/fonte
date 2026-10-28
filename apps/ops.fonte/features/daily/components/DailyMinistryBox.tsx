import { Text, View, type LayoutChangeEvent } from 'react-native';
import type { DailyPerson } from '@fonte/types';
import { personKey } from '../lib/dailyBoard';
import { DailyDraggableCard, type DailyDragHandlers } from './DailyDraggableCard';

interface Props extends DailyDragHandlers {
  boxKey: string;
  title: string;
  members: DailyPerson[];
  /** Caixa sob o card que está sendo arrastado (realce de drop). */
  isOver: boolean;
  disabled: boolean;
  draggingKey: string | null;
  onPressPerson: (person: DailyPerson) => void;
  onBoxLayout: (boxKey: string, y: number, height: number) => void;
}

/** Caixa do board: título + contador; drop zone com realce no hover. */
export function DailyMinistryBox({
  boxKey, title, members, isOver, disabled, draggingKey, onPressPerson, onBoxLayout, ...drag
}: Props) {
  const handleLayout = (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    onBoxLayout(boxKey, y, height);
  };

  return (
    <View
      testID={`daily-box-${boxKey}`}
      onLayout={handleLayout}
      className={`rounded-xl border-2 p-3 gap-2 ${isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-gray-800">{title}</Text>
        <Text testID={`daily-box-count-${boxKey}`} className="text-xs text-gray-500">
          {members.length}
        </Text>
      </View>
      {members.length === 0 ? (
        <Text className="text-xs text-gray-400 py-2 text-center">Ninguém aqui</Text>
      ) : (
        members.map((person) => (
          <DailyDraggableCard
            key={personKey(person)}
            person={person}
            disabled={disabled}
            onPress={onPressPerson}
            isDragging={draggingKey === personKey(person)}
            {...drag}
          />
        ))
      )}
    </View>
  );
}

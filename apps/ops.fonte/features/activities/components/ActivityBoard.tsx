import { useRef, useState, type ReactElement } from 'react';
import {
  FlatList,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type { ActivityStatus } from '@fonte/types';
import type { ActivityColumnData } from '@/features/activities/lib/columns';
import { ActivityStatusTabs } from './ActivityStatusTabs';

interface Props {
  columns: ActivityColumnData[];
  active: ActivityStatus;
  onSelect: (status: ActivityStatus) => void;
  renderColumn: (column: ActivityColumnData, width: number) => ReactElement;
}

/**
 * Quadro de atividades do ops (story 208): abas por status no topo e um pager
 * horizontal com uma coluna por página. Tocar no chip ou deslizar troca a coluna,
 * e os dois ficam sincronizados.
 *
 * A troca por swipe é lida no `onScroll` quando a página assenta num múltiplo da
 * largura — `onMomentumScrollEnd` não existe no react-native-web, e o build web
 * é onde roda o e2e do app.
 */
export function ActivityBoard({ columns, active, onSelect, renderColumn }: Props) {
  const pagerRef = useRef<FlatList<ActivityColumnData>>(null);
  const { width: windowWidth } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const width = measuredWidth || windowWidth;
  const activeIndex = Math.max(
    0,
    columns.findIndex((c) => c.status === active),
  );

  const scrollToColumn = (index: number) => {
    // Sem animação: animar passaria pelas colunas do meio e o chip piscaria.
    pagerRef.current?.scrollToOffset({ offset: index * width, animated: false });
  };

  const handleSelect = (status: ActivityStatus) => {
    // As abas saem das próprias `columns`: o status sempre tem coluna.
    onSelect(status);
    scrollToColumn(columns.findIndex((c) => c.status === status));
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    if (next > 0 && next !== measuredWidth) setMeasuredWidth(next);
    // Garante a coluna ativa visível mesmo se a plataforma ignorar o
    // `initialScrollIndex` (ou depois de girar a tela).
    pagerRef.current?.scrollToOffset({ offset: activeIndex * (next || width), animated: false });
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / width);
    if (Math.abs(x - index * width) > 1) return;
    const column = columns[index];
    if (column && column.status !== active) onSelect(column.status);
  };

  return (
    <View className="flex-1">
      <ActivityStatusTabs
        tabs={columns.map((c) => ({ status: c.status, title: c.title, count: c.data.length }))}
        active={active}
        onSelect={handleSelect}
      />
      <View className="flex-1" testID="activity-board-pages" onLayout={handleLayout}>
        <FlatList
          ref={pagerRef}
          testID="activity-board-pager"
          data={columns}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(c) => c.status}
          initialScrollIndex={activeIndex}
          getItemLayout={(_data, index) => ({ length: width, offset: width * index, index })}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          // A coluna depende de estado da page (rede, mutation pendente) que não
          // muda `columns`: sem isso o FlatList (PureComponent) não re-renderiza.
          extraData={renderColumn}
          renderItem={({ item }) => renderColumn(item, width)}
        />
      </View>
    </View>
  );
}

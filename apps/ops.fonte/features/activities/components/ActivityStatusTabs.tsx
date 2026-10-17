import { useEffect, useRef } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { ActivityStatus } from '@fonte/types';

export interface ActivityStatusTab {
  status: ActivityStatus;
  title: string;
  count: number;
}

interface Props {
  tabs: ActivityStatusTab[];
  active: ActivityStatus;
  onSelect: (status: ActivityStatus) => void;
}

/** Margem à esquerda do chip ativo quando a faixa rola até ele. */
const SCROLL_MARGIN = 16;

/**
 * Faixa de chips roláveis, um por status, com o contador da coluna (story 208).
 * O chip ativo rola para ficar visível quando a aba muda (toque ou swipe).
 */
export function ActivityStatusTabs({ tabs, active, onSelect }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Partial<Record<ActivityStatus, number>>>({});

  useEffect(() => {
    const x = offsets.current[active];
    if (x === undefined) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, x - SCROLL_MARGIN), animated: true });
  }, [active]);

  return (
    <View className="bg-white border-b border-gray-100">
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
      >
        {tabs.map((tab) => {
          const selected = tab.status === active;
          return (
            <TouchableOpacity
              key={tab.status}
              testID={`activity-tab-${tab.status}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              // O react-native-web ignora `accessibilityState.selected` no DOM.
              aria-selected={selected}
              accessibilityLabel={`${tab.title} ${tab.count}`}
              onPress={() => onSelect(tab.status)}
              onLayout={(e) => {
                offsets.current[tab.status] = e.nativeEvent.layout.x;
              }}
              className={`flex-row items-center rounded-full px-3 py-1.5 border ${
                selected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-200'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${selected ? 'text-white' : 'text-gray-700'}`}
              >
                {tab.title}
              </Text>
              <Text
                testID={`activity-tab-count-${tab.status}`}
                className={`text-xs font-semibold ml-1.5 ${
                  selected ? 'text-indigo-100' : 'text-gray-400'
                }`}
              >
                {tab.count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

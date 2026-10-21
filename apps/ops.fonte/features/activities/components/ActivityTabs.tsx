import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ActivityComments } from './ActivityComments';
import { ActivityHistory } from './ActivityHistory';

type DetailsTab = 'comments' | 'history';

interface TabButtonProps {
  active: boolean;
  onPress: () => void;
  children: string;
}

export function TabButton({ active, onPress, children }: TabButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="px-4 py-2"
      style={{
        borderBottomWidth: 2,
        borderBottomColor: active ? '#4f46e5' : 'transparent',
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text
        className={
          active ? 'text-sm font-semibold text-gray-900' : 'text-sm font-medium text-gray-500'
        }
      >
        {children}
      </Text>
    </TouchableOpacity>
  );
}

interface Props {
  activityId: string;
  /** Casa da atividade: o histórico resolve nomes pelos servos dela. */
  houseId: string | null | undefined;
}

/** Abas inferiores do detalhe: Comentários (story 65) | Histórico (story 220). */
export function ActivityTabs({ activityId, houseId }: Props) {
  const [tab, setTab] = useState<DetailsTab>('comments');

  return (
    <View>
      <View className="flex-row border-b border-gray-200 mb-3">
        <TabButton active={tab === 'comments'} onPress={() => setTab('comments')}>
          Comentários
        </TabButton>
        <TabButton active={tab === 'history'} onPress={() => setTab('history')}>
          Histórico
        </TabButton>
      </View>

      {tab === 'comments' ? (
        <ActivityComments activityId={activityId} />
      ) : (
        <ActivityHistory activityId={activityId} houseId={houseId} />
      )}
    </View>
  );
}

import { useState } from 'react';
import { Pressable, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { useMinistryDetail } from '../hooks/useMinistries';
import { MinistryOverviewTab } from '../components/MinistryOverviewTab';
import { MinistryTasksTab } from '../components/MinistryTasksTab';
import { LeaderPickerModal } from '../components/LeaderPickerModal';
import { AddTaskModal } from '../components/AddTaskModal';
import { LoadingState } from '@/components/shared/LoadingState';

const TABS = ['Visão Geral', 'Tarefas'] as const;
type Tab = (typeof TABS)[number];

export function MinistryDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { staff } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('Visão Geral');
  const [leaderModalOpen, setLeaderModalOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);

  const { data: ministry, isLoading } = useMinistryDetail(id);

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Ministério' }} />
        <LoadingState />
      </>
    );
  }

  if (!ministry) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">Ministério não encontrado.</Text>
      </View>
    );
  }

  const houseId = ministry.houseId ?? staff?.houseId ?? '';

  return (
    <>
      <Stack.Screen
        options={{
          title: ministry.name,
          headerStyle: { backgroundColor: '#272950' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ marginLeft: 4, marginRight: 8 }}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
          ),
        }}
      />

      <View className="flex-1 bg-white">
        <View className="flex-row border-b border-gray-200">
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 py-3 items-center border-b-2 ${activeTab === tab ? 'border-blue-600' : 'border-transparent'}`}
            >
              <Text className={`text-sm font-medium ${activeTab === tab ? 'text-blue-600' : 'text-gray-500'}`}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'Visão Geral' && (
          <MinistryOverviewTab
            ministryId={id ?? ''}
            houseId={houseId}
            ministry={ministry}
            onEditLeader={() => setLeaderModalOpen(true)}
          />
        )}

        {activeTab === 'Tarefas' && (
          <MinistryTasksTab
            ministryId={id ?? ''}
            onAddTask={() => setAddTaskOpen(true)}
          />
        )}
      </View>

      <LeaderPickerModal
        visible={leaderModalOpen}
        onClose={() => setLeaderModalOpen(false)}
        ministryId={id ?? ''}
        houseId={houseId}
        currentLeaderId={ministry.leaderId}
      />

      <AddTaskModal
        visible={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        ministryId={id ?? ''}
      />
    </>
  );
}

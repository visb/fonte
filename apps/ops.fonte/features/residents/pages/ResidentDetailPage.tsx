import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useResidentById } from '../hooks/useResidents';
import { ChangeMinistryModal } from '../components/ChangeMinistryModal';
import { ResetResidentPasswordModal } from '../components/ResetResidentPasswordModal';
import { ResidentOverviewTab } from '../components/ResidentOverviewTab';
import { ResidentFamiliesTab } from '../components/ResidentFamiliesTab';
import { ResidentAttachmentsTab } from '../components/ResidentAttachmentsTab';
import { ResidentTrackingTab } from '../components/ResidentTrackingTab';
import { LoadingState } from '@/components/shared/LoadingState';

const TABS = ['Visão Geral', 'Acompanhamento', 'Familiares', 'Anexos'] as const;
type Tab = (typeof TABS)[number];

export function ResidentDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('Visão Geral');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [ministryModalOpen, setMinistryModalOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);

  const { data: resident, isLoading, refetch } = useResidentById(id);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Filho' }} />
        <LoadingState />
      </>
    );
  }

  if (!resident) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">Filho não encontrado.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: resident.name }} />

      <View className="flex-1 bg-white">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="border-b border-gray-200 flex-grow-0"
          contentContainerClassName="px-4"
        >
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`py-3 px-3 mr-1 border-b-2 ${activeTab === tab ? 'border-blue-600' : 'border-transparent'}`}
            >
              <Text className={`text-sm font-medium ${activeTab === tab ? 'text-blue-600' : 'text-gray-500'}`}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          className="flex-1"
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        >
          {activeTab === 'Visão Geral' && (
            <ResidentOverviewTab
              resident={resident}
              onChangeMinistry={() => setMinistryModalOpen(true)}
              onResetPassword={() => setResetPasswordOpen(true)}
            />
          )}

          {activeTab === 'Acompanhamento' && (
            <ResidentTrackingTab residentId={id!} />
          )}

          {activeTab === 'Familiares' && (
            <View className="px-4 py-4">
              <ResidentFamiliesTab residentId={id!} />
            </View>
          )}

          {activeTab === 'Anexos' && (
            <View className="px-4 py-4">
              <ResidentAttachmentsTab residentId={id!} />
            </View>
          )}
        </ScrollView>
      </View>

      {resident.houseId && (
        <ChangeMinistryModal
          visible={ministryModalOpen}
          onClose={() => setMinistryModalOpen(false)}
          residentId={id!}
          houseId={resident.houseId}
          currentMinistryId={resident.ministryId}
        />
      )}
      {resident.userId && (
        <ResetResidentPasswordModal
          visible={resetPasswordOpen}
          onClose={() => setResetPasswordOpen(false)}
          residentId={id!}
          residentName={resident.name}
        />
      )}
    </>
  );
}

import { useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { HouseMinistry } from '@fonte/api-client';
import { useAuth } from '@/lib/auth';
import { useMinistries } from '../hooks/useMinistries';
import { MinistryCard } from '../components/MinistryCard';
import { CreateMinistryModal } from '../components/CreateMinistryModal';
import { LoadingState } from '@/components/shared/LoadingState';

export function MinistriesPage() {
  const { staff } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: ministries = [], isLoading, refetch } = useMinistries(staff?.houseId);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Ministérios',
          headerStyle: { backgroundColor: '#272950' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
        }}
      />

      <View className="flex-1 bg-gray-50">
        {isLoading ? (
          <LoadingState />
        ) : (
          <FlatList
            data={ministries}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 88 }}
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            ListEmptyComponent={
              <Text className="text-center text-gray-500 text-sm py-8">
                Nenhum ministério cadastrado.
              </Text>
            }
            renderItem={({ item }: { item: HouseMinistry }) => <MinistryCard ministry={item} />}
          />
        )}

        <TouchableOpacity
          accessibilityLabel="Novo ministério"
          className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full items-center justify-center shadow-lg"
          onPress={() => setCreateOpen(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <CreateMinistryModal
        visible={createOpen}
        houseId={staff?.houseId ?? ''}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => refetch()}
      />
    </>
  );
}

import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { SupportGroupCheckin } from '@fonte/api-client';
import { useMeetingDetail, useAddCheckin, useRemoveCheckin } from '../hooks/useSupportGroups';
import { useAllResidents } from '@/features/residents/hooks/useResidents';
import { CheckinRow } from '../components/CheckinRow';
import { QRCodeModal } from '../components/QRCodeModal';
import { LoadingState } from '@/components/shared/LoadingState';

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

export function MeetingDetailPage() {
  const { meetingId } = useLocalSearchParams<{ meetingId: string }>();

  const [qrVisible, setQrVisible] = useState(false);
  const [search, setSearch] = useState('');

  const { data: meeting, isLoading } = useMeetingDetail(meetingId);
  const { data: residents = [] } = useAllResidents();
  const addCheckin = useAddCheckin(meetingId ?? '');
  const removeCheckin = useRemoveCheckin(meetingId ?? '');

  const checkedInIds = useMemo(
    () => new Set((meeting?.checkins ?? []).map((c: SupportGroupCheckin) => c.residentId)),
    [meeting?.checkins],
  );

  const filteredResidents = useMemo(
    () =>
      residents.filter(
        (r) => r.name.toLowerCase().includes(search.toLowerCase()) && !checkedInIds.has(r.id),
      ),
    [residents, search, checkedInIds],
  );

  function handleCheckin(residentId: string) {
    addCheckin.mutate({ residentId });
    setSearch('');
  }

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Reunião' }} />
        <LoadingState />
      </>
    );
  }

  if (!meeting) {
    return (
      <>
        <Stack.Screen options={{ title: 'Reunião' }} />
        <View className="flex-1 items-center justify-center bg-gray-50">
          <Text className="text-gray-500">Reunião não encontrada.</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: meeting.supportGroupName,
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

      <View className="flex-1 bg-gray-50">
        <FlatList
          data={meeting.checkins}
          keyExtractor={(item: SupportGroupCheckin) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
          ListHeaderComponent={
            <View className="gap-4">
              <View className="bg-white rounded-xl border border-gray-200 p-4">
                <Text className="text-base font-semibold text-gray-900">{meeting.supportGroupName}</Text>
                <Text className="text-sm text-gray-500 mt-0.5">{formatDate(meeting.date)}</Text>
                {meeting.notes ? (
                  <Text className="text-sm text-gray-400 mt-1 italic">{meeting.notes}</Text>
                ) : null}
              </View>

              <TouchableOpacity
                className="bg-indigo-600 rounded-xl py-3.5 flex-row items-center justify-center gap-2"
                onPress={() => setQrVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="qr-code-outline" size={20} color="#fff" />
                <Text className="text-sm font-semibold text-white">Exibir QR Code para Checkin</Text>
              </TouchableOpacity>

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-2">Registrar presença manualmente</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white"
                  placeholder="Buscar pelo nome do filho..."
                  value={search}
                  onChangeText={setSearch}
                />
                {search.length > 0 && (
                  <View className="border border-gray-200 rounded-xl overflow-hidden mt-1 bg-white">
                    {filteredResidents.length === 0 ? (
                      <Text className="text-sm text-gray-400 px-4 py-3">Nenhum resultado.</Text>
                    ) : (
                      filteredResidents.slice(0, 5).map((r) => (
                        <TouchableOpacity
                          key={r.id}
                          className="px-4 py-3 border-b border-gray-100 flex-row items-center justify-between"
                          onPress={() => handleCheckin(r.id)}
                          disabled={addCheckin.isPending}
                        >
                          <Text className="text-sm text-gray-900">{r.name}</Text>
                          <Ionicons name="add-circle-outline" size={18} color="#2563eb" />
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}
              </View>

              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-gray-700">
                  Presenças ({meeting.checkins.length})
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <Text className="text-sm text-gray-400 text-center py-4">
              Nenhuma família registrada ainda.
            </Text>
          }
          renderItem={({ item }: { item: SupportGroupCheckin }) => (
            <CheckinRow
              checkin={item}
              onRemove={(id) => removeCheckin.mutate(id)}
              isRemoving={removeCheckin.isPending}
            />
          )}
        />
      </View>

      <QRCodeModal
        visible={qrVisible}
        onClose={() => setQrVisible(false)}
        meetingId={meeting.id}
        groupName={meeting.supportGroupName}
        date={meeting.date}
      />
    </>
  );
}

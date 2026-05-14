import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import type { SupportGroup, SupportGroupMeeting } from '@fonte/api-client';
import { DAY_OF_WEEK_LABELS } from '@fonte/types';
import { useAllMeetings, useCreateMeeting, useSupportGroups } from '../hooks/useSupportGroups';
import { DatePickerModal } from '@/components/DatePickerModal';

function nextMeetingDate(dayOfWeek: number): string {
  const today = new Date();
  const diff = (dayOfWeek - today.getDay() + 7) % 7;
  const next = new Date(today);
  next.setDate(today.getDate() + diff);
  return next.toISOString().split('T')[0];
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split('T')[0];
}

export function SupportGroupsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<SupportGroup | null>(null);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: meetings = [], isLoading, refetch } = useAllMeetings();
  const { data: groups = [] } = useSupportGroups();

  const createMutation = useCreateMeeting(selectedGroup?.id ?? '');

  const sortedMeetings = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayMeetings = meetings.filter((m: SupportGroupMeeting) => m.date === today);
    const otherMeetings = meetings.filter((m: SupportGroupMeeting) => m.date !== today);
    return [...todayMeetings, ...otherMeetings];
  }, [meetings]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  function openCreate() {
    const firstGroup = groups[0] ?? null;
    setSelectedGroup(firstGroup);
    setDate(firstGroup ? nextMeetingDate(firstGroup.dayOfWeek) : new Date().toISOString().split('T')[0]);
    setNotes('');
    setCreateOpen(true);
  }

  function handleGroupChange(group: SupportGroup) {
    setSelectedGroup(group);
    setDate(nextMeetingDate(group.dayOfWeek));
  }

  function handleCreate() {
    if (!selectedGroup || !date) return;
    createMutation.mutate(
      { date, notes: notes.trim() || null },
      {
        onSuccess: () => {
          setCreateOpen(false);
          refetch();
        },
      },
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Grupos de Apoio',
          headerStyle: { backgroundColor: '#272950' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
        }}
      />

      <View className="flex-1 bg-gray-50">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        ) : (
          <FlatList
            data={sortedMeetings}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 88 }}
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            ListEmptyComponent={
              <Text className="text-center text-gray-500 text-sm py-8">
                Nenhuma reunião cadastrada.
              </Text>
            }
            renderItem={({ item }: { item: SupportGroupMeeting }) => {
              const today = isToday(item.date);
              return (
                <TouchableOpacity
                  className={`rounded-xl p-4 border ${today ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onPress={() => router.push(`/(app)/support-groups/${item.id}` as any)}
                  activeOpacity={0.7}
                >
                  {today && (
                    <View className="flex-row items-center gap-1 mb-1">
                      <View className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <Text className="text-xs font-semibold text-blue-600">HOJE</Text>
                    </View>
                  )}
                  <Text className="text-base font-semibold text-gray-900">{item.supportGroupName}</Text>
                  <Text className="text-sm text-gray-500 mt-0.5">{formatDate(item.date)}</Text>
                  {item.notes ? (
                    <Text className="text-xs text-gray-400 mt-1 italic">{item.notes}</Text>
                  ) : null}
                  <View className="flex-row items-center gap-1 mt-2">
                    <Ionicons name="people-outline" size={13} color="#6b7280" />
                    <Text className="text-xs text-gray-500">
                      {item.checkinCount} {item.checkinCount === 1 ? 'família presente' : 'famílias presentes'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}

        <TouchableOpacity
          className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full items-center justify-center shadow-lg"
          onPress={openCreate}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <Modal visible={createOpen} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={() => setCreateOpen(false)} />
          <View className="bg-white rounded-t-3xl" style={{ maxHeight: '80%' }}>
            <View className="px-5 pt-5 pb-3 border-b border-gray-100 flex-row items-center">
              <Text className="flex-1 text-base font-semibold text-gray-900">Nova reunião</Text>
              <Pressable onPress={() => setCreateOpen(false)}>
                <Ionicons name="close" size={20} color="#4b5563" />
              </Pressable>
            </View>

            <ScrollView
              className="px-5"
              contentContainerStyle={{ paddingVertical: 20, gap: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Grupo *</Text>
                {groups.length === 0 ? (
                  <Text className="text-sm text-gray-400">Nenhum grupo cadastrado.</Text>
                ) : (
                  <View className="border border-gray-200 rounded-xl overflow-hidden">
                    {groups.map((g: SupportGroup) => (
                      <TouchableOpacity
                        key={g.id}
                        className={`px-4 py-3 flex-row items-center border-b border-gray-100 ${selectedGroup?.id === g.id ? 'bg-blue-50' : 'bg-white'}`}
                        onPress={() => handleGroupChange(g)}
                      >
                        <View className={`w-4 h-4 rounded-full border-2 mr-3 items-center justify-center ${selectedGroup?.id === g.id ? 'border-blue-500' : 'border-gray-300'}`}>
                          {selectedGroup?.id === g.id && <View className="w-2 h-2 rounded-full bg-blue-500" />}
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm text-gray-900">{g.name}</Text>
                          <Text className="text-xs text-gray-400">{DAY_OF_WEEK_LABELS[g.dayOfWeek]} · {g.churchName}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Data *</Text>
                <TouchableOpacity
                  className="border border-gray-300 rounded-lg px-3 py-2.5 flex-row items-center justify-between"
                  onPress={() => setDatePickerOpen(true)}
                >
                  <Text className={`text-sm ${date ? 'text-gray-900' : 'text-gray-400'}`}>
                    {date ? formatDate(date) : 'Selecionar data'}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <View>
                <Text className="text-sm font-medium text-gray-700 mb-1.5">Observações (opcional)</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900"
                  placeholder="Ex: Local alternativo, tema especial..."
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={2}
                />
              </View>
            </ScrollView>

            <View className="px-5 py-4 border-t border-gray-100 flex-row gap-3">
              <TouchableOpacity
                className="flex-1 border border-gray-200 rounded-xl py-3 items-center"
                onPress={() => setCreateOpen(false)}
                disabled={createMutation.isPending}
              >
                <Text className="text-sm font-medium text-gray-600">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-blue-600 rounded-xl py-3 items-center"
                onPress={handleCreate}
                disabled={!selectedGroup || !date || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-sm font-medium text-white">Criar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <DatePickerModal
        visible={datePickerOpen}
        value={date}
        onClose={() => setDatePickerOpen(false)}
        onChange={setDate}
      />
    </>
  );
}

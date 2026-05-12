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
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import {
  useMinistryDetail,
  useMinistryTasks,
  useUpdateMinistry,
  useAddResident,
  useRemoveResident,
  useAddStaff,
  useRemoveStaff,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useHouseResidentsForMinistry,
  useHouseStaffForMinistry,
} from '../hooks/useMinistries';

const TABS = ['Visão Geral', 'Tarefas'] as const;
type Tab = (typeof TABS)[number];

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-5 mb-2">
      {children}
    </Text>
  );
}

function isCompletedToday(completedAt: string | null): boolean {
  if (!completedAt) return false;
  const today = new Date().toISOString().slice(0, 10);
  return completedAt.slice(0, 10) === today;
}

export function MinistryDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { staff } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('Visão Geral');

  const { data: ministry, isLoading } = useMinistryDetail(id);
  const { data: tasks = [], isLoading: tasksLoading } = useMinistryTasks(
    activeTab === 'Tarefas' ? id : undefined,
  );

  const { data: allResidents = [] } = useHouseResidentsForMinistry(
    activeTab === 'Visão Geral' ? staff?.houseId : undefined,
  );
  const { data: allStaff = [] } = useHouseStaffForMinistry(
    activeTab === 'Visão Geral' ? staff?.houseId : undefined,
  );

  const [leaderModalOpen, setLeaderModalOpen] = useState(false);
  const [residentSearch, setResidentSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskRepetition, setNewTaskRepetition] = useState<'NONE' | 'DAILY'>('NONE');

  const updateMinistry = useUpdateMinistry(id ?? '', ministry?.houseId ?? staff?.houseId ?? '');
  const addResident = useAddResident(id ?? '');
  const removeResident = useRemoveResident(id ?? '');
  const addStaff = useAddStaff(id ?? '');
  const removeStaff = useRemoveStaff(id ?? '');
  const createTask = useCreateTask(id ?? '');
  const updateTask = useUpdateTask(id ?? '');
  const deleteTask = useDeleteTask(id ?? '');

  const memberResidentIds = useMemo(
    () => new Set(ministry?.members.filter((m) => m.role === 'FILHO').map((m) => m.id) ?? []),
    [ministry],
  );
  const memberStaffIds = useMemo(
    () => new Set(ministry?.members.filter((m) => m.role === 'SERVO').map((m) => m.id) ?? []),
    [ministry],
  );

  const availableResidents = useMemo(
    () =>
      allResidents
        .filter((r) => !memberResidentIds.has(r.id))
        .filter((r) => r.name.toLowerCase().includes(residentSearch.toLowerCase())),
    [allResidents, memberResidentIds, residentSearch],
  );

  const availableStaff = useMemo(
    () =>
      allStaff
        .filter((s) => !memberStaffIds.has(s.id))
        .filter((s) => s.name.toLowerCase().includes(staffSearch.toLowerCase())),
    [allStaff, memberStaffIds, staffSearch],
  );

  const allStaffForLeader = useMemo(
    () =>
      allStaff.filter((s) => s.name.toLowerCase().includes('')),
    [allStaff],
  );

  function handleCreateTask() {
    if (!newTaskTitle.trim()) return;
    createTask.mutate(
      { title: newTaskTitle.trim(), repetition: newTaskRepetition },
      {
        onSuccess: () => {
          setNewTaskTitle('');
          setNewTaskRepetition('NONE');
          setAddTaskOpen(false);
        },
      },
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!ministry) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">Ministério não encontrado.</Text>
      </View>
    );
  }

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
        {/* Tab bar */}
        <View className="flex-row border-b border-gray-200">
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 py-3 items-center border-b-2 ${
                activeTab === tab ? 'border-blue-600' : 'border-transparent'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  activeTab === tab ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Visão Geral Tab */}
        {activeTab === 'Visão Geral' && (
          <ScrollView className="flex-1 px-4">
            {/* Leader */}
            <SectionLabel>Líder</SectionLabel>
            <View className="flex-row items-center py-3 border-b border-gray-100">
              <Ionicons name="person-circle-outline" size={36} color="#6b7280" />
              <Text className="flex-1 text-sm text-gray-900 ml-3">
                {ministry.leaderName ?? '—'}
              </Text>
              <TouchableOpacity onPress={() => setLeaderModalOpen(true)}>
                <Text className="text-sm text-blue-600 font-medium">Editar</Text>
              </TouchableOpacity>
            </View>

            {/* Add filho */}
            <SectionLabel>Adicionar Filho</SectionLabel>
            <TextInput
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 mb-2"
              placeholder="Buscar filho..."
              value={residentSearch}
              onChangeText={setResidentSearch}
            />
            {residentSearch.length > 0 && availableResidents.length > 0 && (
              <View className="border border-gray-200 rounded-lg mb-2 overflow-hidden">
                {availableResidents.slice(0, 5).map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    className="px-4 py-3 border-b border-gray-100 flex-row items-center justify-between"
                    onPress={() => {
                      addResident.mutate(r.id, { onSuccess: () => setResidentSearch('') });
                    }}
                  >
                    <Text className="text-sm text-gray-900">{r.name}</Text>
                    <Ionicons name="add-circle-outline" size={20} color="#2563eb" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {residentSearch.length > 0 && availableResidents.length === 0 && (
              <Text className="text-sm text-gray-400 mb-2">Nenhum filho disponível.</Text>
            )}

            {/* Add servo */}
            <SectionLabel>Adicionar Servo</SectionLabel>
            <TextInput
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 mb-2"
              placeholder="Buscar servo (staff)..."
              value={staffSearch}
              onChangeText={setStaffSearch}
            />
            {staffSearch.length > 0 && availableStaff.length > 0 && (
              <View className="border border-gray-200 rounded-lg mb-2 overflow-hidden">
                {availableStaff.slice(0, 5).map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    className="px-4 py-3 border-b border-gray-100 flex-row items-center justify-between"
                    onPress={() => {
                      addStaff.mutate(s.id, { onSuccess: () => setStaffSearch('') });
                    }}
                  >
                    <Text className="text-sm text-gray-900">{s.name}</Text>
                    <Ionicons name="add-circle-outline" size={20} color="#2563eb" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {staffSearch.length > 0 && availableStaff.length === 0 && (
              <Text className="text-sm text-gray-400 mb-2">Nenhum servo disponível.</Text>
            )}

            {/* Members list */}
            <SectionLabel>{`Operadores (${ministry.members.length})`}</SectionLabel>
            {ministry.members.length === 0 ? (
              <Text className="text-sm text-gray-400 py-2">Nenhum operador adicionado.</Text>
            ) : (
              ministry.members.map((member) => (
                <View
                  key={member.id}
                  className="flex-row items-center py-3 border-b border-gray-100"
                >
                  <View className="flex-1 flex-row items-center">
                    <Text className="text-sm text-gray-900">{member.name}</Text>
                    <View
                      className={`ml-2 px-2 py-0.5 rounded-full ${
                        member.role === 'FILHO' ? 'bg-blue-100' : 'bg-purple-100'
                      }`}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          member.role === 'FILHO' ? 'text-blue-700' : 'text-purple-700'
                        }`}
                      >
                        {member.role === 'FILHO' ? 'Filho' : 'Servo'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    className="ml-2 p-1"
                    onPress={() => {
                      if (member.role === 'FILHO') {
                        removeResident.mutate(member.id);
                      } else {
                        removeStaff.mutate(member.id);
                      }
                    }}
                  >
                    <Ionicons name="remove-circle-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))
            )}
            <View className="h-8" />
          </ScrollView>
        )}

        {/* Tarefas Tab */}
        {activeTab === 'Tarefas' && (
          <>
            {tasksLoading ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#2563eb" />
              </View>
            ) : (
              <FlatList
                data={tasks}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, gap: 8 }}
                ListEmptyComponent={
                  <Text className="text-center text-gray-500 text-sm py-8">
                    Nenhuma tarefa cadastrada.
                  </Text>
                }
                renderItem={({ item }) => {
                  const done =
                    item.repetition === 'DAILY'
                      ? isCompletedToday(item.completedAt)
                      : item.completed;

                  return (
                    <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-4 py-3 gap-3">
                      <TouchableOpacity
                        onPress={() =>
                          updateTask.mutate({ taskId: item.id, data: { completed: !done } })
                        }
                      >
                        <Ionicons
                          name={done ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={done ? '#2563eb' : '#9ca3af'}
                        />
                      </TouchableOpacity>
                      <View className="flex-1">
                        <Text
                          className={`text-sm ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}
                        >
                          {item.title}
                        </Text>
                        {item.repetition === 'DAILY' && (
                          <Text className="text-xs text-gray-400 mt-0.5">Repetição diária</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => deleteTask.mutate(item.id)}
                      >
                        <Ionicons name="close-circle-outline" size={20} color="#9ca3af" />
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            )}

            <TouchableOpacity
              className="absolute bottom-6 right-6 bg-blue-600 w-14 h-14 rounded-full items-center justify-center shadow-md"
              onPress={() => setAddTaskOpen(true)}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Leader picker modal */}
      <Modal visible={leaderModalOpen} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <Pressable className="flex-1" onPress={() => setLeaderModalOpen(false)} />
          <View className="bg-white rounded-t-3xl max-h-[60%]">
            <View className="px-5 pt-5 pb-3 border-b border-gray-100 flex-row items-center">
              <Text className="flex-1 text-base font-semibold text-gray-900">Selecionar Líder</Text>
              <Pressable onPress={() => setLeaderModalOpen(false)}>
                <Ionicons name="close" size={20} color="#4b5563" />
              </Pressable>
            </View>
            <ScrollView className="px-5" contentContainerClassName="py-4 gap-2">
              <TouchableOpacity
                className="py-3 px-4 rounded-xl border border-gray-200"
                onPress={() => {
                  updateMinistry.mutate(
                    { leaderId: null, leaderType: null },
                    { onSuccess: () => setLeaderModalOpen(false) },
                  );
                }}
              >
                <Text className="text-sm text-gray-500">— Sem líder</Text>
              </TouchableOpacity>
              {allStaffForLeader.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  className={`py-3 px-4 rounded-xl border ${
                    ministry.leaderId === s.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                  onPress={() => {
                    updateMinistry.mutate(
                      { leaderId: s.id, leaderType: 'STAFF' },
                      { onSuccess: () => setLeaderModalOpen(false) },
                    );
                  }}
                >
                  <Text className="text-sm text-gray-900">{s.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add task modal */}
      <Modal visible={addTaskOpen} transparent animationType="fade">
        <Pressable
          className="flex-1 bg-black/40 justify-center px-6"
          onPress={() => { setAddTaskOpen(false); setNewTaskTitle(''); setNewTaskRepetition('NONE'); }}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className="bg-white rounded-2xl p-6">
              <Text className="text-base font-semibold text-gray-900 mb-4">Nova Tarefa</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 mb-4"
                placeholder="Título da tarefa"
                value={newTaskTitle}
                onChangeText={setNewTaskTitle}
                autoFocus
              />
              <Text className="text-sm font-medium text-gray-700 mb-2">Repetição</Text>
              <View className="flex-row gap-3 mb-4">
                <TouchableOpacity
                  className={`flex-1 py-2.5 rounded-lg border items-center ${
                    newTaskRepetition === 'NONE' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                  onPress={() => setNewTaskRepetition('NONE')}
                >
                  <Text
                    className={`text-sm ${newTaskRepetition === 'NONE' ? 'text-blue-600 font-medium' : 'text-gray-600'}`}
                  >
                    Não repetir
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 py-2.5 rounded-lg border items-center ${
                    newTaskRepetition === 'DAILY' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                  onPress={() => setNewTaskRepetition('DAILY')}
                >
                  <Text
                    className={`text-sm ${newTaskRepetition === 'DAILY' ? 'text-blue-600 font-medium' : 'text-gray-600'}`}
                  >
                    Diária
                  </Text>
                </TouchableOpacity>
              </View>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 border border-gray-200 rounded-lg py-2.5 items-center"
                  onPress={() => { setAddTaskOpen(false); setNewTaskTitle(''); setNewTaskRepetition('NONE'); }}
                >
                  <Text className="text-sm text-gray-600">Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-blue-600 rounded-lg py-2.5 items-center"
                  onPress={handleCreateTask}
                  disabled={!newTaskTitle.trim() || createTask.isPending}
                >
                  <Text className="text-sm text-white font-medium">
                    {createTask.isPending ? 'Adicionando...' : 'Adicionar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

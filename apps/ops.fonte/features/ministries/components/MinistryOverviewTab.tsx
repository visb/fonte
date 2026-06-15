import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MinistryDetail } from '@fonte/api-client';
import {
  useAddResident,
  useRemoveResident,
  useAddStaff,
  useRemoveStaff,
  useHouseResidentsForMinistry,
  useHouseStaffForMinistry,
} from '../hooks/useMinistries';
import { normalizeForSearch } from '@/lib/searchUtils';

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-5 mb-2">
      {children}
    </Text>
  );
}

interface Props {
  ministryId: string;
  houseId: string;
  ministry: MinistryDetail;
  onEditLeader: () => void;
}

export function MinistryOverviewTab({ ministryId, houseId, ministry, onEditLeader }: Props) {
  const [residentSearch, setResidentSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');

  const { data: allResidents = [] } = useHouseResidentsForMinistry(houseId);
  const { data: allStaff = [] } = useHouseStaffForMinistry(houseId);

  const addResident = useAddResident(ministryId);
  const removeResident = useRemoveResident(ministryId);
  const addStaff = useAddStaff(ministryId);
  const removeStaff = useRemoveStaff(ministryId);

  const memberResidentIds = useMemo(
    () => new Set(ministry.members.filter((m) => m.role === 'FILHO').map((m) => m.id)),
    [ministry.members],
  );
  const memberStaffIds = useMemo(
    () => new Set(ministry.members.filter((m) => m.role === 'SERVO').map((m) => m.id)),
    [ministry.members],
  );

  const availableResidents = useMemo(
    () =>
      allResidents
        .filter((r) => !memberResidentIds.has(r.id))
        .filter((r) => normalizeForSearch(r.name).includes(normalizeForSearch(residentSearch))),
    [allResidents, memberResidentIds, residentSearch],
  );

  const availableStaff = useMemo(
    () =>
      allStaff
        .filter((s) => !memberStaffIds.has(s.id))
        .filter((s) => normalizeForSearch(s.name).includes(normalizeForSearch(staffSearch))),
    [allStaff, memberStaffIds, staffSearch],
  );

  return (
    <ScrollView className="flex-1 px-4">
      <SectionLabel>Líder</SectionLabel>
      <View className="flex-row items-center py-3 border-b border-gray-100">
        <Ionicons name="person-circle-outline" size={36} color="#6b7280" />
        <Text className="flex-1 text-sm text-gray-900 ml-3">{ministry.leaderName ?? '—'}</Text>
        <TouchableOpacity onPress={onEditLeader}>
          <Text className="text-sm text-blue-600 font-medium">Editar</Text>
        </TouchableOpacity>
      </View>

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
              onPress={() => addResident.mutate(r.id, { onSuccess: () => setResidentSearch('') })}
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
              onPress={() => addStaff.mutate(s.id, { onSuccess: () => setStaffSearch('') })}
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

      <SectionLabel>{`Servos (${ministry.members.length})`}</SectionLabel>
      {ministry.members.length === 0 ? (
        <Text className="text-sm text-gray-400 py-2">Nenhum servo adicionado.</Text>
      ) : (
        ministry.members.map((member) => (
          <View key={member.id} className="flex-row items-center py-3 border-b border-gray-100">
            <View className="flex-1 flex-row items-center">
              <Text className="text-sm text-gray-900">{member.name}</Text>
              <View className={`ml-2 px-2 py-0.5 rounded-full ${member.role === 'FILHO' ? 'bg-blue-100' : 'bg-purple-100'}`}>
                <Text className={`text-xs font-medium ${member.role === 'FILHO' ? 'text-blue-700' : 'text-purple-700'}`}>
                  {member.role === 'FILHO' ? 'Filho' : 'Servo'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              className="ml-2 p-1"
              onPress={() => {
                if (member.role === 'FILHO') removeResident.mutate(member.id);
                else removeStaff.mutate(member.id);
              }}
            >
              <Ionicons name="remove-circle-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ))
      )}
      <View className="h-8" />
    </ScrollView>
  );
}

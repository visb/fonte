import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MinistryDetail } from '@fonte/api-client';
import { useAddStaff, useRemoveStaff } from '../hooks/useMinistries';
import { useHouseStaff } from '@/features/staff/hooks/useHouseStaff';
import { OfflineNotice } from '@/components/shared/OfflineNotice';
import { ServantRankBadge } from '@/components/shared/ServantRankBadge';
import { useIsOnline } from '@/lib/offline/network';
import { normalizeForSearch } from '@/lib/searchUtils';
import { MinistryResidentsSection } from './MinistryResidentsSection';
import { SectionLabel } from './SectionLabel';

interface Props {
  ministryId: string;
  houseId: string;
  ministry: MinistryDetail;
  onEditLeader: () => void;
}

// Story 205: filho volta a ser membro (seção própria). Ações de ministério
// exigem rede (decisão 9): sem sinal ficam desabilitadas com aviso.
export function MinistryOverviewTab({ ministryId, houseId, ministry, onEditLeader }: Props) {
  const [staffSearch, setStaffSearch] = useState('');
  const isOnline = useIsOnline();

  const { data: allStaff = [] } = useHouseStaff(houseId);

  const addStaff = useAddStaff(ministryId);
  const removeStaff = useRemoveStaff(ministryId);

  const staffMembers = useMemo(() => ministry.members.filter((m) => m.role === 'SERVO'), [ministry.members]);
  const residentMembers = useMemo(() => ministry.members.filter((m) => m.role === 'FILHO'), [ministry.members]);
  const memberStaffIds = useMemo(() => new Set(staffMembers.map((m) => m.id)), [staffMembers]);

  const availableStaff = useMemo(
    () =>
      allStaff
        .filter((s) => !memberStaffIds.has(s.id))
        .filter((s) => normalizeForSearch(s.name).includes(normalizeForSearch(staffSearch))),
    [allStaff, memberStaffIds, staffSearch],
  );

  return (
    <ScrollView className="flex-1 px-4">
      {!isOnline && (
        <View className="mt-4">
          <OfflineNotice message="Precisa de conexão para alterar o ministério." />
        </View>
      )}

      <SectionLabel>Líder</SectionLabel>
      <View className="flex-row items-center py-3 border-b border-gray-100">
        <Ionicons name="person-circle-outline" size={36} color="#6b7280" />
        <View className="flex-1 flex-row items-center flex-wrap gap-2 ml-3">
          <Text className="text-sm text-gray-900">{ministry.leaderName ?? '—'}</Text>
          {/* Story 207: nível só de líder servo. */}
          <ServantRankBadge rank={ministry.leaderType === 'STAFF' ? ministry.leaderRank : null} />
        </View>
        <TouchableOpacity onPress={onEditLeader} disabled={!isOnline} accessibilityLabel="Editar líder">
          <Text className={`text-sm font-medium ${isOnline ? 'text-blue-600' : 'text-gray-300'}`}>Editar</Text>
        </TouchableOpacity>
      </View>

      <MinistryResidentsSection
        ministryId={ministryId}
        houseId={houseId}
        members={residentMembers}
        isOnline={isOnline}
      />

      <SectionLabel>Adicionar Servo</SectionLabel>
      <TextInput
        className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 mb-2"
        placeholder="Buscar servo (staff)..."
        value={staffSearch}
        onChangeText={setStaffSearch}
        editable={isOnline}
      />
      {isOnline && staffSearch.length > 0 && availableStaff.length > 0 && (
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
      {isOnline && staffSearch.length > 0 && availableStaff.length === 0 && (
        <Text className="text-sm text-gray-400 mb-2">Nenhum servo disponível.</Text>
      )}

      <SectionLabel>{`Servos (${staffMembers.length})`}</SectionLabel>
      {staffMembers.length === 0 ? (
        <Text className="text-sm text-gray-400 py-2">Nenhum servo adicionado.</Text>
      ) : (
        staffMembers.map((member) => (
          <View key={member.id} className="flex-row items-center py-3 border-b border-gray-100">
            <View className="flex-1 flex-row items-center">
              <Text className="text-sm text-gray-900">{member.name}</Text>
              <View className="ml-2 px-2 py-0.5 rounded-full bg-purple-100">
                <Text className="text-xs font-medium text-purple-700">Servo</Text>
              </View>
            </View>
            <TouchableOpacity
              className="ml-2 p-1"
              disabled={!isOnline}
              onPress={() => removeStaff.mutate(member.id)}
            >
              <Ionicons name="remove-circle-outline" size={20} color={isOnline ? '#ef4444' : '#d1d5db'} />
            </TouchableOpacity>
          </View>
        ))
      )}
      <View className="h-8" />
    </ScrollView>
  );
}

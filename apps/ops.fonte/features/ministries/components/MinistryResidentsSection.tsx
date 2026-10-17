import { useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MinistryMember } from '@fonte/api-client';
import { normalizeForSearch } from '@/lib/searchUtils';
import { useAddResident, useMinistryEligibleResidents, useRemoveResident } from '../hooks/useMinistries';
import { SectionLabel } from './SectionLabel';

interface Props {
  ministryId: string;
  houseId: string;
  /** Só os membros com role FILHO. */
  members: MinistryMember[];
  isOnline: boolean;
}

/**
 * Story 205 — filhos do ministério. "Adicionar filho" busca só os filhos **em
 * acolhimento** da casa (lista do store local, abre offline); quem já saiu não
 * aparece. Adicionar/remover exige rede: sem sinal, desabilita com aviso.
 */
export function MinistryResidentsSection({ ministryId, houseId, members, isOnline }: Props) {
  const [search, setSearch] = useState('');
  const { data: eligible = [] } = useMinistryEligibleResidents(houseId);
  const addResident = useAddResident(ministryId, houseId);
  const removeResident = useRemoveResident(ministryId, houseId);

  const memberIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);
  const available = useMemo(
    () =>
      eligible
        .filter((r) => !memberIds.has(r.id))
        .filter((r) => normalizeForSearch(r.name).includes(normalizeForSearch(search))),
    [eligible, memberIds, search],
  );

  return (
    <View>
      <SectionLabel>Adicionar Filho</SectionLabel>
      <TextInput
        className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 my-2"
        placeholder="Buscar filho em acolhimento..."
        value={search}
        onChangeText={setSearch}
        editable={isOnline}
      />
      {isOnline && search.length > 0 && available.length > 0 && (
        <View className="border border-gray-200 rounded-lg mb-2 overflow-hidden">
          {available.slice(0, 5).map((r) => (
            <TouchableOpacity
              key={r.id}
              accessibilityLabel={`Adicionar ${r.name}`}
              className="px-4 py-3 border-b border-gray-100 flex-row items-center justify-between"
              disabled={addResident.isPending}
              onPress={() => addResident.mutate(r.id, { onSuccess: () => setSearch('') })}
            >
              <Text className="text-sm text-gray-900">{r.name}</Text>
              <Ionicons name="add-circle-outline" size={20} color="#2563eb" />
            </TouchableOpacity>
          ))}
        </View>
      )}
      {isOnline && search.length > 0 && available.length === 0 && (
        <Text className="text-sm text-gray-400 mb-2">Nenhum filho em acolhimento disponível.</Text>
      )}

      <SectionLabel>{`Filhos (${members.length})`}</SectionLabel>
      {members.length === 0 ? (
        <Text className="text-sm text-gray-400 py-2">Nenhum filho adicionado.</Text>
      ) : (
        members.map((member) => (
          <View key={member.id} className="flex-row items-center py-3 border-b border-gray-100">
            <View className="flex-1 flex-row items-center">
              <Text className="text-sm text-gray-900">{member.name}</Text>
              <View className="ml-2 px-2 py-0.5 rounded-full bg-blue-100">
                <Text className="text-xs font-medium text-blue-700">Filho</Text>
              </View>
            </View>
            <TouchableOpacity
              accessibilityLabel={`Remover ${member.name}`}
              className="ml-2 p-1"
              disabled={!isOnline || removeResident.isPending}
              onPress={() => removeResident.mutate(member.id)}
            >
              <Ionicons name="remove-circle-outline" size={20} color={isOnline ? '#ef4444' : '#d1d5db'} />
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}

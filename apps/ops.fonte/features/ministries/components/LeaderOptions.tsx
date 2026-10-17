import { Text, TouchableOpacity, View } from 'react-native';
import type { MinistryLeaderType } from '@fonte/api-client';

export interface LeaderChoice {
  id: string;
  type: MinistryLeaderType;
}

interface Person {
  id: string;
  name: string;
}

interface Props {
  staff: Person[];
  /** Filhos em acolhimento da casa (story 205) — já filtrados. */
  residents: Person[];
  selected: LeaderChoice | null;
  onSelect: (choice: LeaderChoice | null) => void;
  disabled?: boolean;
}

const BADGE: Record<MinistryLeaderType, { label: string; bg: string; text: string }> = {
  STAFF: { label: 'Servo', bg: 'bg-blue-100', text: 'text-blue-700' },
  RESIDENT: { label: 'Filho', bg: 'bg-green-100', text: 'text-green-700' },
};

function Radio({ selected }: { selected: boolean }) {
  return (
    <View className={`w-4 h-4 rounded-full border-2 mr-3 items-center justify-center ${selected ? 'border-blue-500' : 'border-gray-300'}`}>
      {selected && <View className="w-2 h-2 rounded-full bg-blue-500" />}
    </View>
  );
}

/** Lista de líderes possíveis: servos e filhos em acolhimento (story 205). */
export function LeaderOptions({ staff, residents, selected, onSelect, disabled }: Props) {
  const options: Array<Person & { type: MinistryLeaderType }> = [
    ...staff.map((s) => ({ ...s, type: 'STAFF' as const })),
    ...residents.map((r) => ({ ...r, type: 'RESIDENT' as const })),
  ];

  return (
    <View className="border border-gray-200 rounded-xl overflow-hidden">
      <TouchableOpacity
        className={`px-4 py-3 flex-row items-center border-b border-gray-100 ${selected === null ? 'bg-blue-50' : 'bg-white'}`}
        disabled={disabled}
        onPress={() => onSelect(null)}
      >
        <Radio selected={selected === null} />
        <Text className="text-sm text-gray-500">— Sem líder</Text>
      </TouchableOpacity>

      {options.length === 0 && (
        <Text className="px-4 py-3 text-sm text-gray-400">Nenhuma pessoa disponível.</Text>
      )}

      {options.map((o) => {
        const isSelected = selected?.id === o.id && selected.type === o.type;
        const badge = BADGE[o.type];
        return (
          <TouchableOpacity
            key={`${o.type}-${o.id}`}
            accessibilityLabel={`Líder ${o.name}`}
            accessibilityState={{ selected: isSelected }}
            className={`px-4 py-3 flex-row items-center border-b border-gray-100 ${isSelected ? 'bg-blue-50' : 'bg-white'}`}
            disabled={disabled}
            onPress={() => onSelect({ id: o.id, type: o.type })}
          >
            <Radio selected={isSelected} />
            <Text className="flex-1 text-sm text-gray-900">{o.name}</Text>
            <View className={`px-2 py-0.5 rounded ${badge.bg}`}>
              <Text className={`text-xs font-medium ${badge.text}`}>{badge.label}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

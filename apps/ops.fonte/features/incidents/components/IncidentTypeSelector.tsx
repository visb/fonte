import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { IncidentType } from '@fonte/types';
import { INCIDENT_TYPE_CONFIG, INCIDENT_TYPES } from '@/lib/constants';

type Props = {
  /** Sem default (story 229): `undefined` até o operador escolher. */
  value: IncidentType | undefined;
  onChange: (type: IncidentType) => void;
  error?: string;
};

/** Dois botões grandes lado a lado — 👍 Positiva / 👎 Negativa. */
export function IncidentTypeSelector({ value, onChange, error }: Props) {
  return (
    <View>
      <View className="flex-row gap-3" accessibilityRole="radiogroup">
        {INCIDENT_TYPES.map((type) => {
          const cfg = INCIDENT_TYPE_CONFIG[type];
          const selected = value === type;
          return (
            <TouchableOpacity
              key={type}
              testID={`incident-type-${type}`}
              accessibilityRole="radio"
              accessibilityLabel={cfg.label}
              accessibilityState={{ selected, checked: selected }}
              className="flex-1 py-4 rounded-xl border-2 items-center"
              style={
                selected
                  ? { backgroundColor: cfg.color, borderColor: cfg.color }
                  : { backgroundColor: '#ffffff', borderColor: error ? '#ef4444' : '#e5e7eb' }
              }
              onPress={() => onChange(type)}
            >
              <Ionicons
                name={selected ? cfg.iconSelected : cfg.icon}
                size={28}
                color={selected ? '#ffffff' : cfg.color}
              />
              <Text
                className="text-sm font-semibold mt-1"
                style={{ color: selected ? '#ffffff' : cfg.color }}
              >
                {cfg.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {error && <Text className="text-xs text-red-500 mt-1">{error}</Text>}
    </View>
  );
}

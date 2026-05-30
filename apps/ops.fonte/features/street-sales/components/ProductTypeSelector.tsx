import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StreetSaleType } from '@fonte/types';

const OPTIONS = [
  { type: StreetSaleType.BREAD, label: 'Pão', icon: 'nutrition-outline' as const, activeColor: '#b45309', activeBg: '#fffbeb', activeBorder: '#d97706' },
  { type: StreetSaleType.PIZZA, label: 'Pizza', icon: 'pizza-outline' as const, activeColor: '#dc2626', activeBg: '#fef2f2', activeBorder: '#ef4444' },
];

type Props = {
  value: StreetSaleType;
  onChange: (t: StreetSaleType) => void;
};

export function ProductTypeSelector({ value, onChange }: Props) {
  return (
    <View>
      <Text className="text-sm font-medium text-gray-700 mb-2">Produto</Text>
      <View className="flex-row gap-3">
        {OPTIONS.map((opt) => {
          const active = value === opt.type;
          return (
            <TouchableOpacity
              key={opt.type}
              className="flex-1 py-3 rounded-lg border items-center"
              style={{
                backgroundColor: active ? opt.activeBg : '#f9fafb',
                borderColor: active ? opt.activeBorder : '#e5e7eb',
              }}
              onPress={() => onChange(opt.type)}
            >
              <View className="flex-row items-center gap-1.5">
                <Ionicons
                  name={opt.icon}
                  size={20}
                  color={active ? opt.activeColor : '#9ca3af'}
                />
                <Text
                  className="text-sm font-semibold"
                  style={{ color: active ? opt.activeColor : '#6b7280' }}
                >
                  {opt.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

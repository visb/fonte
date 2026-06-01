import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SupplyRoomCategory } from "@fonte/types";

const OPTIONS: { value: SupplyRoomCategory; label: string }[] = [
  { value: SupplyRoomCategory.CLEANING, label: "Limpeza" },
  { value: SupplyRoomCategory.HYGIENE, label: "Higiene" },
  { value: SupplyRoomCategory.PPE, label: "EPI" },
  { value: SupplyRoomCategory.OFFICE, label: "Escritório" },
  { value: SupplyRoomCategory.OTHER, label: "Outros" },
];

type Props = {
  value: SupplyRoomCategory | null;
  onChange: (v: SupplyRoomCategory) => void;
  error?: string;
};

export function CategorySelector({ value, onChange, error }: Props) {
  return (
    <View>
      <Text className="text-sm font-medium text-gray-700 mb-1.5">
        Categoria <Text className="text-red-500">*</Text>
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
        <View className="flex-row gap-2">
          {OPTIONS.map((opt) => {
            const selected = value === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => onChange(opt.value)}
                className={`px-3 py-2 rounded-lg border ${
                  selected ? "bg-blue-600 border-blue-600" : "bg-gray-50 border-gray-300"
                }`}
              >
                <Text className={`text-sm font-medium ${selected ? "text-white" : "text-gray-700"}`}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      {error && <Text className="text-xs text-red-500 mt-1">{error}</Text>}
    </View>
  );
}

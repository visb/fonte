import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MovementType } from "@fonte/types";

type Props = {
  value: MovementType;
  onChange: (t: MovementType) => void;
};

export function MovementTypeSelector({ value, onChange }: Props) {
  return (
    <View>
      <Text className="text-sm font-medium text-gray-700 mb-2">Tipo</Text>
      <View className="flex-row gap-3">
      {([MovementType.IN, MovementType.OUT] as const).map((t) => (
        <TouchableOpacity
          key={t}
          className={`flex-1 py-3 rounded-lg border items-center ${
            value === t
              ? t === MovementType.IN
                ? "bg-green-50 border-green-500"
                : "bg-red-50 border-red-500"
              : "border-gray-200 bg-gray-50"
          }`}
          onPress={() => onChange(t)}
        >
          <View className="flex-row items-center gap-1.5">
            <Ionicons
              name={t === MovementType.IN ? "arrow-up-outline" : "arrow-down-outline"}
              size={20}
              color={
                value === t
                  ? t === MovementType.IN
                    ? "#16a34a"
                    : "#dc2626"
                  : "#9ca3af"
              }
            />
            <Text
              className="text-sm font-semibold"
              style={{
                color:
                  value === t
                    ? t === MovementType.IN
                      ? "#16a34a"
                      : "#dc2626"
                    : "#6b7280",
              }}
            >
              {t === MovementType.IN ? "Entrada" : "Saída"}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
      </View>
    </View>
  );
}

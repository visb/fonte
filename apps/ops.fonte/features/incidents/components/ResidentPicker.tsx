import { View, Text, TouchableOpacity } from "react-native";

type Resident = { id: string; name: string };

type Props = {
  value: string;
  residents: Resident[];
  onChange: (id: string) => void;
};

export function ResidentPicker({ value, residents, onChange }: Props) {
  return (
    <View className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
      <TouchableOpacity className="px-4 py-3" onPress={() => onChange("")}>
        <Text className={`text-sm ${!value ? "text-gray-400" : "text-gray-900"}`}>
          {value
            ? residents.find((r) => r.id === value)?.name
            : "Nenhum específico"}
        </Text>
      </TouchableOpacity>
      {residents.map((r) => (
        <TouchableOpacity
          key={r.id}
          className={`px-4 py-2.5 border-t border-gray-200 ${value === r.id ? "bg-blue-50" : ""}`}
          onPress={() => onChange(r.id)}
        >
          <Text
            className={`text-sm ${value === r.id ? "text-blue-600 font-medium" : "text-gray-700"}`}
          >
            {r.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

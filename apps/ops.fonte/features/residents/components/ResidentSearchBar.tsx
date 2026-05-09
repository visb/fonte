import { View, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
};

export function ResidentSearchBar({ value, onChangeText, onClear }: Props) {
  return (
    <View className="bg-white px-4 py-3 border-b border-gray-100">
      <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
        <Ionicons name="search-outline" size={16} color="#6b7280" />
        <TextInput
          className="flex-1 ml-2 text-sm text-gray-800"
          placeholder="Buscar filho..."
          value={value}
          onChangeText={onChangeText}
        />
        {value ? (
          <TouchableOpacity onPress={onClear}>
            <Ionicons name="close-circle" size={16} color="#6b7280" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

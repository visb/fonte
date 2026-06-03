import { View, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  onPressFilter: () => void;
  filterActive: boolean;
};

export function ResidentSearchBar({
  value,
  onChangeText,
  onClear,
  onPressFilter,
  filterActive,
}: Props) {
  return (
    <View className="bg-white px-4 py-3 border-b border-gray-100 flex-row items-center gap-2">
      <View className="flex-1 flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
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
      <TouchableOpacity
        className={`w-10 h-10 rounded-lg items-center justify-center ${
          filterActive ? 'bg-blue-600' : 'bg-gray-100'
        }`}
        onPress={onPressFilter}
        hitSlop={8}
      >
        <Ionicons
          name="options-outline"
          size={18}
          color={filterActive ? '#fff' : '#6b7280'}
        />
      </TouchableOpacity>
    </View>
  );
}

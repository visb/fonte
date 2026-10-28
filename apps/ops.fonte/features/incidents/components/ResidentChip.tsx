import { Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  name: string;
  onRemove: () => void;
};

/** Filho selecionado na ocorrência; o "x" tira da seleção (story 227). */
export function ResidentChip({ name, onRemove }: Props) {
  return (
    <TouchableOpacity
      className="flex-row items-center bg-blue-50 border border-blue-200 rounded-full pl-3 pr-2 py-1 mr-2 mb-2"
      onPress={onRemove}
      accessibilityRole="button"
      accessibilityLabel={`Remover ${name}`}
    >
      <Text className="text-xs font-medium text-blue-700 mr-1">{name}</Text>
      <Ionicons name="close" size={14} color="#1d4ed8" />
    </TouchableOpacity>
  );
}

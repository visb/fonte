import { Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  name: string;
  checked: boolean;
  onToggle: () => void;
};

/** Linha da lista de filhos com checkbox (multi-seleção — story 227). */
export function ResidentCheckboxRow({ name, checked, onToggle }: Props) {
  return (
    <TouchableOpacity
      className={`flex-row items-center px-4 py-2.5 border-t border-gray-200 ${checked ? "bg-blue-50" : ""}`}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={name}
    >
      <Ionicons
        name={checked ? "checkbox" : "square-outline"}
        size={20}
        color={checked ? "#2563eb" : "#9ca3af"}
      />
      <Text
        className={`text-sm ml-3 ${checked ? "text-blue-600 font-medium" : "text-gray-700"}`}
      >
        {name}
      </Text>
    </TouchableOpacity>
  );
}

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";

type Props = {
  name: string;
  onConfirm: (unit: string) => void;
  onCancel: () => void;
  isPending: boolean;
};

export function NewItemForm({ name, onConfirm, onCancel, isPending }: Props) {
  const [unit, setUnit] = useState("");

  function handleConfirm() {
    if (!unit.trim()) {
      Alert.alert("Atenção", "Informe a unidade de medida.");
      return;
    }
    onConfirm(unit.trim());
  }

  return (
    <View className="border border-blue-200 rounded-lg p-4 bg-blue-50">
      <Text className="text-sm font-medium text-gray-700 mb-3">
        Novo item:{" "}
        <Text className="font-semibold text-gray-900">{name}</Text>
      </Text>
      <Text className="text-sm text-gray-600 mb-1.5">Unidade de medida</Text>
      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 bg-white mb-3"
        placeholder="Ex: kg, L, unid., cx..."
        value={unit}
        onChangeText={setUnit}
        autoFocus
      />
      <View className="flex-row gap-2">
        <TouchableOpacity
          className="flex-1 py-2.5 rounded-lg border border-gray-300 items-center bg-white"
          onPress={onCancel}
        >
          <Text className="text-sm text-gray-600">Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 py-2.5 rounded-lg bg-blue-600 items-center"
          onPress={handleConfirm}
          disabled={isPending}
        >
          {isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-sm font-semibold text-white">Cadastrar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

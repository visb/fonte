import { View, Text, TextInput } from "react-native";

type Props = {
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  error?: string;
};

export function QuantityField({ value, onChange, unit, error }: Props) {
  return (
    <View>
      <Text className="text-sm font-medium text-gray-700 mb-1.5">
        Quantidade ({unit ?? "unid."}){" "}
        <Text className="text-red-500">*</Text>
      </Text>
      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50"
        placeholder="0"
        keyboardType="numeric"
        value={value}
        onChangeText={onChange}
      />
      {error && <Text className="text-xs text-red-500 mt-1">{error}</Text>}
    </View>
  );
}

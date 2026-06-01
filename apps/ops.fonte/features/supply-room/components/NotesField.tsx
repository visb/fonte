import { View, Text, TextInput } from "react-native";

type Props = {
  value?: string;
  onChange: (v: string) => void;
};

export function NotesField({ value, onChange }: Props) {
  return (
    <View>
      <Text className="text-sm font-medium text-gray-700 mb-1.5">
        Observações (opcional)
      </Text>
      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50"
        placeholder="Ex: compra do mercado, uso na limpeza..."
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        value={value}
        onChangeText={onChange}
      />
    </View>
  );
}

import { View, Text } from "react-native";

type Props = {
  name?: string;
};

export function ResponsibleDisplay({ name }: Props) {
  return (
    <View className="bg-gray-50 rounded-lg px-4 py-3">
      <Text className="text-xs text-gray-500">Responsável</Text>
      <Text className="text-sm font-medium text-gray-800 mt-0.5">
        {name ?? "—"}
      </Text>
    </View>
  );
}

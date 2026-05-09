import { View, Text } from "react-native";

type Props = {
  residentCount: number;
  incidentCount: number;
};

export function StatCards({ residentCount, incidentCount }: Props) {
  return (
    <View className="flex-row gap-3 mb-6">
      <View className="flex-1 bg-white rounded-xl border border-gray-100 p-4">
        <Text className="text-3xl font-bold text-gray-900">{residentCount}</Text>
        <Text className="text-sm text-gray-500 mt-0.5">Filhos na casa</Text>
      </View>
      <View className="flex-1 bg-white rounded-xl border border-gray-100 p-4">
        <Text className="text-3xl font-bold text-gray-900">{incidentCount}</Text>
        <Text className="text-sm text-gray-500 mt-0.5">Ocorrências hoje</Text>
      </View>
    </View>
  );
}

import { View, Text } from "react-native";
import { SEVERITY_CONFIG } from "@/lib/constants";

function fmt(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

type Props = {
  item: {
    id: string;
    date: string;
    severity: string;
    description: string;
    responsible: { name: string };
    resident: { name: string } | null;
  };
};

export function IncidentCard({ item }: Props) {
  const cfg = SEVERITY_CONFIG[item.severity as keyof typeof SEVERITY_CONFIG];
  return (
    <View className="bg-white rounded-xl border border-gray-100 px-4 py-3">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-xs text-gray-500">{fmt(item.date)}</Text>
        <View
          className="rounded-full px-2 py-0.5"
          style={{ backgroundColor: `${cfg?.color ?? "#6b7280"}20` }}
        >
          <Text
            className="text-xs font-medium"
            style={{ color: cfg?.color ?? "#6b7280" }}
          >
            {cfg?.label ?? item.severity}
          </Text>
        </View>
      </View>
      <Text className="text-sm text-gray-800 mb-1.5" numberOfLines={3}>
        {item.description}
      </Text>
      <Text className="text-xs text-gray-400">por {item.responsible?.name}</Text>
      {item.resident && (
        <Text className="text-xs text-blue-600 mt-0.5">
          Filho: {item.resident.name}
        </Text>
      )}
    </View>
  );
}

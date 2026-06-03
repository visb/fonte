import { View, Text, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { STATUS_CONFIG } from "@/lib/constants";
import { resolveAssetUrl } from "@/lib/api";

type Props = {
  item: {
    id: string;
    name: string;
    status: string;
    photoUrl?: string | null;
    photoThumbUrl?: string | null;
  };
};

export function ResidentListItem({ item }: Props) {
  const thumbUrl = resolveAssetUrl(item.photoThumbUrl ?? item.photoUrl);
  return (
    <TouchableOpacity
      className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex-row items-center"
      onPress={() => router.push(`/(app)/residents/${item.id}` as never)}
    >
      <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-3 overflow-hidden">
        {thumbUrl ? (
          <Image
            source={{ uri: thumbUrl }}
            className="w-10 h-10 rounded-full"
          />
        ) : (
          <Ionicons name="person-outline" size={20} color="#2563eb" />
        )}
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-gray-900">{item.name}</Text>
      </View>
      <View
        className="rounded-full px-2 py-0.5"
        style={{
          backgroundColor: `${STATUS_CONFIG[item.status]?.color ?? "#6b7280"}20`,
        }}
      >
        <Text
          className="text-xs font-medium"
          style={{ color: STATUS_CONFIG[item.status]?.color ?? "#6b7280" }}
        >
          {STATUS_CONFIG[item.status]?.label ?? item.status}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

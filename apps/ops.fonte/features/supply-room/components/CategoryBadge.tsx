import { View, Text } from "react-native";
import { SupplyRoomCategory } from "@fonte/types";

const LABELS: Record<SupplyRoomCategory, string> = {
  CLEANING: "Limpeza",
  HYGIENE: "Higiene",
  PPE: "EPI",
  OFFICE: "Escritório",
  OTHER: "Outros",
};

const COLORS: Record<SupplyRoomCategory, { bg: string; text: string }> = {
  CLEANING: { bg: "#eff6ff", text: "#1d4ed8" },
  HYGIENE: { bg: "#f0fdf4", text: "#15803d" },
  PPE: { bg: "#fff7ed", text: "#c2410c" },
  OFFICE: { bg: "#faf5ff", text: "#7e22ce" },
  OTHER: { bg: "#f9fafb", text: "#374151" },
};

export function CategoryBadge({ category }: { category: SupplyRoomCategory }) {
  const color = COLORS[category];
  return (
    <View
      style={{ backgroundColor: color.bg }}
      className="rounded-full px-2 py-0.5 self-start"
    >
      <Text style={{ color: color.text }} className="text-xs font-medium">
        {LABELS[category]}
      </Text>
    </View>
  );
}

import { View, Text, TouchableOpacity } from "react-native";
import { IncidentSeverity } from "@fonte/types";
import { SEVERITY_CONFIG } from "@/lib/constants";

const SEVERITIES = Object.values(IncidentSeverity) as IncidentSeverity[];

type Props = {
  value: IncidentSeverity;
  onChange: (v: IncidentSeverity) => void;
};

export function SeveritySelector({ value, onChange }: Props) {
  return (
    <View className="flex-row gap-2">
      {SEVERITIES.map((s) => {
        const cfg = SEVERITY_CONFIG[s];
        const active = value === s;
        return (
          <TouchableOpacity
            key={s}
            className={`flex-1 py-2 rounded-lg border items-center ${active ? "border-transparent" : "border-gray-200 bg-gray-50"}`}
            style={
              active
                ? { backgroundColor: `${cfg.color}20`, borderColor: cfg.color }
                : {}
            }
            onPress={() => onChange(s)}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: active ? cfg.color : "#6b7280" }}
            >
              {cfg.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

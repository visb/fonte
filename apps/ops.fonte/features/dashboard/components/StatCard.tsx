import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  value: number;
  label: string;
  testID: string;
  /** Sem `onPress` o card é só leitura (perfil sem acesso à lista). */
  onPress?: () => void;
  /** Rótulo de acessibilidade do toque (ex.: "Ver filhos"). */
  accessibilityLabel?: string;
};

const CARD_CLASS = "flex-1 bg-white rounded-xl border border-gray-100 p-4";

function StatCardBody({ value, label, pressable }: { value: number; label: string; pressable: boolean }) {
  return (
    <View className="flex-row items-end justify-between">
      <View>
        <Text className="text-3xl font-bold text-gray-900">{value}</Text>
        <Text className="text-sm text-gray-500 mt-0.5">{label}</Text>
      </View>
      {pressable && <Ionicons name="chevron-forward" size={18} color="#9ca3af" />}
    </View>
  );
}

/** Um contador do dashboard (story 221). Tocável só quando recebe `onPress`. */
export function StatCard({ value, label, testID, onPress, accessibilityLabel }: Props) {
  if (!onPress) {
    return (
      <View testID={testID} className={CARD_CLASS}>
        <StatCardBody value={value} label={label} pressable={false} />
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={CARD_CLASS}
    >
      <StatCardBody value={value} label={label} pressable />
    </Pressable>
  );
}

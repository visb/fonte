import { View } from "react-native";
import { StatCard } from "./StatCard";

type Props = {
  residentCount: number;
  staffCount: number;
  /** Ausente quando o perfil não alcança a lista de filhos (catálogo do menu). */
  onPressResidents?: () => void;
  /** Ausente quando o perfil não alcança a lista de servos (catálogo do menu). */
  onPressStaff?: () => void;
};

/** Contadores do dashboard: filhos e servos da casa (story 221). */
export function StatCards({ residentCount, staffCount, onPressResidents, onPressStaff }: Props) {
  return (
    <View className="flex-row gap-3 mb-6">
      <StatCard
        testID="stat-card-residents"
        value={residentCount}
        label="Filhos na casa"
        accessibilityLabel="Ver filhos"
        onPress={onPressResidents}
      />
      <StatCard
        testID="stat-card-staff"
        value={staffCount}
        label="Servos na casa"
        accessibilityLabel="Ver servos"
        onPress={onPressStaff}
      />
    </View>
  );
}

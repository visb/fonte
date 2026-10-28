import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { IncidentType } from "@fonte/types";
import { INCIDENT_TYPE_CONFIG } from "@/lib/constants";
import { incidentCategoryLabel } from "../constants";

/**
 * Configuração do badge. Cache persistido antes da story 229 (só `severity`,
 * sem `type`) vem de quando toda ocorrência era um problema — vira Negativa,
 * igual ao backfill do backend.
 */
export function incidentTypeConfig(type: string | undefined) {
  return (
    INCIDENT_TYPE_CONFIG[type as IncidentType] ?? INCIDENT_TYPE_CONFIG[IncidentType.NEGATIVE]
  );
}

type Props = {
  /** Story 229. Opcional só para tolerar cache persistido antes da 229. */
  type?: string;
  /** Story 230. `null` em ocorrência antiga; ausente em cache anterior à 230. */
  category?: string | null;
};

/**
 * Classificação da ocorrência: label da categoria + badge do tipo (stories
 * 229/230). Compartilhado entre o card da lista e o item da aba Acompanhamento
 * da ficha do filho (story 228).
 */
export function IncidentClassificationBadge({ type, category }: Props) {
  const cfg = incidentTypeConfig(type);
  return (
    <View className="flex-row items-center flex-shrink">
      {/* Antigas (sem categoria) = "Sem categoria". */}
      <Text
        testID="incident-category-label"
        className="text-xs text-gray-600 mr-2 flex-shrink"
        numberOfLines={1}
      >
        {incidentCategoryLabel(category)}
      </Text>
      <View
        testID="incident-type-badge"
        className="flex-row items-center rounded-full px-2 py-0.5"
        style={{ backgroundColor: cfg.bg }}
      >
        <Ionicons name={cfg.iconSelected} size={12} color={cfg.color} />
        <Text className="text-xs font-medium ml-1" style={{ color: cfg.color }}>
          {cfg.label}
        </Text>
      </View>
    </View>
  );
}

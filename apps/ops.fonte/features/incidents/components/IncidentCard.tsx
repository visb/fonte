import { View, Text } from "react-native";
import { SEVERITY_CONFIG } from "@/lib/constants";
import { isOutboxEntityId } from "@/lib/offline/outbox";
import { PendingBadge } from "@/components/shared/PendingBadge";

function fmt(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Quantos nomes aparecem no card antes do "+N" (story 227). */
export const INCIDENT_CARD_MAX_NAMES = 3;

/** "A, B, C" ou "A, B, C +2" quando passa do limite. */
export function formatInvolvedResidents(names: string[]): string {
  const shown = names.slice(0, INCIDENT_CARD_MAX_NAMES).join(", ");
  const hidden = names.length - INCIDENT_CARD_MAX_NAMES;
  return hidden > 0 ? `${shown} +${hidden}` : shown;
}

type Props = {
  item: {
    id: string;
    date: string;
    severity: string;
    description: string;
    responsible: { name: string };
    residents: { name: string }[];
  };
};

export function IncidentCard({ item }: Props) {
  const cfg = SEVERITY_CONFIG[item.severity as keyof typeof SEVERITY_CONFIG];
  // Cache persistido antes da story 227 ainda pode trazer o formato antigo
  // (`resident`) até o próximo refetch — sem `residents`, o card não quebra.
  const residents = item.residents ?? [];
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
      {residents.length > 0 && (
        <Text className="text-xs text-blue-600 mt-0.5">
          {`${residents.length === 1 ? "Filho" : "Filhos"}: ${formatInvolvedResidents(
            residents.map((r) => r.name),
          )}`}
        </Text>
      )}
      {/* Registrada sem sinal: está na fila, ainda não chegou ao servidor. */}
      {isOutboxEntityId(item.id) && (
        <View className="mt-2">
          <PendingBadge />
        </View>
      )}
    </View>
  );
}

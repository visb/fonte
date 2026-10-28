import { View, Text } from "react-native";
import { isOutboxEntityId } from "@/lib/offline/outbox";
import { PendingBadge } from "@/components/shared/PendingBadge";
import { IncidentClassificationBadge } from "./IncidentClassificationBadge";

// Mantido aqui por compatibilidade: a configuração mora no badge compartilhado.
export { incidentTypeConfig } from "./IncidentClassificationBadge";

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
    /** Story 229. Opcional só para tolerar cache persistido antes da 229. */
    type?: string;
    /** Story 230. `null` em ocorrência antiga; ausente em cache anterior à 230. */
    category?: string | null;
    description: string;
    responsible: { name: string };
    residents: { name: string }[];
  };
};

export function IncidentCard({ item }: Props) {
  // Cache persistido antes da story 227 ainda pode trazer o formato antigo
  // (`resident`) até o próximo refetch — sem `residents`, o card não quebra.
  const residents = item.residents ?? [];
  return (
    <View className="bg-white rounded-xl border border-gray-100 px-4 py-3">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-xs text-gray-500">{fmt(item.date)}</Text>
        <View className="ml-2 flex-shrink">
          <IncidentClassificationBadge type={item.type} category={item.category} />
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

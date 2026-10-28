import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PendingBadge } from '@/components/shared/PendingBadge';
import { isOutboxEntityId } from '@/lib/offline/outbox';
import {
  IncidentClassificationBadge,
  incidentTypeConfig,
} from '@/features/incidents/components/IncidentClassificationBadge';
import type { TrackingIncident } from '../lib/trackingTimeline';

interface Props {
  incident: TrackingIncident;
  /** Filho dono da ficha — sai da linha "Com:". */
  residentId: string;
}

function formatDate(date: string): string {
  return new Date(date.slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Story 228: ocorrência na linha do tempo da aba Acompanhamento. Mesmo layout do
 * `TrackingEventItem`; somente leitura (sem tela de detalhe), por isso mostra a
 * descrição completa e todos os outros filhos envolvidos (decisão da story 227).
 */
export function IncidentTrackingItem({ incident, residentId }: Props) {
  const cfg = incidentTypeConfig(incident.type);
  const others = (incident.residents ?? [])
    .filter((r) => r.id !== residentId)
    .map((r) => r.name)
    .filter(Boolean);
  const responsible = incident.responsible?.name;

  return (
    <View
      testID="incident-tracking-item"
      className="flex-row gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 mb-2"
    >
      <View
        className="w-9 h-9 rounded-full items-center justify-center"
        style={{ backgroundColor: cfg.bg }}
      >
        <Ionicons name="alert-circle-outline" size={18} color={cfg.color} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-medium text-gray-900 mr-2">Ocorrência</Text>
          <IncidentClassificationBadge type={incident.type} category={incident.category} />
        </View>
        <Text className="text-sm text-gray-500 mt-0.5">{incident.description}</Text>
        {others.length > 0 && (
          <Text className="text-xs text-blue-600 mt-1">{`Com: ${others.join(', ')}`}</Text>
        )}
        <Text className="text-xs text-gray-400 mt-1">
          {formatDate(incident.date)}
          {responsible ? ` · ${responsible}` : ''}
        </Text>
        {/* Registrada sem sinal: está na fila, ainda não chegou ao servidor. */}
        {isOutboxEntityId(incident.id) && (
          <View className="mt-2">
            <PendingBadge />
          </View>
        )}
      </View>
    </View>
  );
}

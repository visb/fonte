import { View, Text, TouchableOpacity } from 'react-native';
import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import { isOutboxEntityId } from '@/lib/offline/outbox';
import { PendingBadge } from '@/components/shared/PendingBadge';
import { StatusBadge } from './StatusBadge';
import { ResponsibleBadge } from './ResponsibleBadge';
import { ActivityCardActions } from './ActivityCardActions';

interface Props {
  item: Activity;
  /** userId do staff autenticado (do JWT). */
  currentUserId?: string;
  onChangeStatus: (activity: Activity, status: ActivityStatus) => void;
  /** Abre a tela de detalhes ao tocar no corpo do card. */
  onPress?: (activity: Activity) => void;
  pending?: boolean;
  /** Sem rede as mudanças de situação ficam desabilitadas (story 171). */
  isOnline?: boolean;
}

export function ActivityCard({
  item,
  currentUserId,
  onChangeStatus,
  onPress,
  pending,
  isOnline = true,
}: Props) {
  const isCreator = item.createdByUserId === currentUserId;
  const isResponsible = item.responsible?.userId === currentUserId;
  const { status } = item;

  // Criada sem sinal (story 171): ainda está na fila e não tem id do servidor,
  // então não abre detalhe nem muda de situação — só avisa que vai subir.
  if (isOutboxEntityId(item.id)) {
    return (
      <View className="bg-white rounded-xl border border-gray-100 px-4 py-3">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-sm font-semibold text-gray-800 flex-1 pr-2" numberOfLines={2}>
            {item.title}
          </Text>
          <StatusBadge status={status} />
        </View>
        <PendingBadge />
      </View>
    );
  }

  return (
    <View testID={`activity-card-${item.id}`} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={onPress ? 0.6 : 1}
        disabled={!onPress}
        onPress={() => onPress?.(item)}
      >
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-sm font-semibold text-gray-800 flex-1 pr-2" numberOfLines={2}>
            {item.title}
          </Text>
          <StatusBadge status={status} />
        </View>

        {/* Descrição não aparece na lista (story 71): só na tela de detalhes. */}

        <View className="mt-0.5">
          <ResponsibleBadge responsible={item.responsible} />
        </View>
      </TouchableOpacity>

      <ActivityCardActions
        item={item}
        isCreator={isCreator}
        isResponsible={isResponsible}
        onChangeStatus={onChangeStatus}
        pending={pending}
        isOnline={isOnline}
      />
    </View>
  );
}

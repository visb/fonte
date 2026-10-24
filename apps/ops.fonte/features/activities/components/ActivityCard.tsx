import { View, Text, TouchableOpacity } from 'react-native';
import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import { isOutboxEntityId } from '@/lib/offline/outbox';
import { PendingBadge } from '@/components/shared/PendingBadge';
import { StatusBadge } from './StatusBadge';
import { ResponsibleBadge } from './ResponsibleBadge';
import { ActivityCardActions } from './ActivityCardActions';
import {
  canApproveRequest,
  canManageResponsible,
  type ActivityViewer,
} from '../lib/permissions';

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
  /** Role + casa de quem olha: regras do coordenador da casa (story 220). */
  viewer?: ActivityViewer;
  /** Abre o seletor de responsável (story 220); só usado se `viewer` pode trocar. */
  onPressResponsible?: (activity: Activity) => void;
}

export function ActivityCard({
  item,
  currentUserId,
  onChangeStatus,
  onPress,
  pending,
  isOnline = true,
  viewer,
  onPressResponsible,
}: Props) {
  const isCreator = item.createdByUserId === currentUserId;
  const isResponsible = item.responsible?.userId === currentUserId;
  const canApprove = !!viewer && canApproveRequest(item, viewer);
  const canChangeResponsible =
    !!viewer && !!onPressResponsible && canManageResponsible(item, viewer);
  const { status } = item;

  // Criada sem sinal (story 171): ainda está na fila e não tem id do servidor,
  // então não abre detalhe nem muda de situação — só avisa que vai subir.
  if (isOutboxEntityId(item.id)) {
    return (
      <View
        testID="activity-card-pending"
        className="bg-white rounded-xl border border-gray-100 px-4 py-3"
      >
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-sm font-semibold text-gray-800 flex-1 pr-2" numberOfLines={2}>
            {item.title}
          </Text>
          <StatusBadge status={status} />
        </View>
        {/* Criada já com responsável (story 224): só leitura até subir. */}
        {item.responsibleStaffId && (
          <View className="mb-1">
            <ResponsibleBadge responsible={item.responsible} />
          </View>
        )}
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

        {!canChangeResponsible && (
          <View className="mt-0.5">
            <ResponsibleBadge responsible={item.responsible} />
          </View>
        )}
      </TouchableOpacity>

      {/* Tocável fica fora do corpo: um toque não pode abrir detalhe e seletor. */}
      {canChangeResponsible && (
        <View className="mt-0.5">
          <ResponsibleBadge
            responsible={item.responsible}
            onPress={() => onPressResponsible?.(item)}
            disabled={!isOnline}
          />
          {!isOnline && (
            <Text className="text-xs text-gray-400 mt-1">
              Precisa de conexão para trocar o responsável.
            </Text>
          )}
        </View>
      )}

      <ActivityCardActions
        item={item}
        isCreator={isCreator}
        isResponsible={isResponsible}
        canApprove={canApprove}
        onChangeStatus={onChangeStatus}
        pending={pending}
        isOnline={isOnline}
      />
    </View>
  );
}

import { View, Text, TouchableOpacity } from 'react-native';
import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import { StatusBadge } from './StatusBadge';
import { ResponsibleBadge } from './ResponsibleBadge';

interface Props {
  item: Activity;
  /** userId do staff autenticado (do JWT). */
  currentUserId?: string;
  onChangeStatus: (activity: Activity, status: ActivityStatus) => void;
  /** Abre a tela de detalhes ao tocar no corpo do card. */
  onPress?: (activity: Activity) => void;
  pending?: boolean;
}

function ActionButton({
  label,
  color,
  onPress,
  disabled,
}: {
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className="rounded-lg px-3 py-1.5"
      style={{ backgroundColor: `${color}15`, opacity: disabled ? 0.5 : 1 }}
    >
      <Text className="text-xs font-semibold" style={{ color }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function ActivityCard({ item, currentUserId, onChangeStatus, onPress, pending }: Props) {
  const isCreator = item.createdByUserId === currentUserId;
  const isResponsible = item.responsible?.userId === currentUserId;
  const { status } = item;

  return (
    <View className="bg-white rounded-xl border border-gray-100 px-4 py-3">
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

      <View className="flex-row flex-wrap gap-2 mt-2">
        {status === ActivityStatus.DRAFT && isCreator && (
          <ActionButton
            label="Enviar"
            color="#2563eb"
            disabled={pending}
            onPress={() => onChangeStatus(item, ActivityStatus.REQUESTED)}
          />
        )}

        {isResponsible && status === ActivityStatus.TODO && (
          <ActionButton
            label="Iniciar"
            color="#b45309"
            disabled={pending}
            onPress={() => onChangeStatus(item, ActivityStatus.DOING)}
          />
        )}

        {isResponsible && status === ActivityStatus.DOING && (
          <>
            <ActionButton
              label="Impedir"
              color="#dc2626"
              disabled={pending}
              onPress={() => onChangeStatus(item, ActivityStatus.BLOCKED)}
            />
            <ActionButton
              label="Concluir"
              color="#16a34a"
              disabled={pending}
              onPress={() => onChangeStatus(item, ActivityStatus.DONE)}
            />
          </>
        )}

        {isResponsible && status === ActivityStatus.BLOCKED && (
          <>
            <ActionButton
              label="Retomar"
              color="#b45309"
              disabled={pending}
              onPress={() => onChangeStatus(item, ActivityStatus.DOING)}
            />
            <ActionButton
              label="Concluir"
              color="#16a34a"
              disabled={pending}
              onPress={() => onChangeStatus(item, ActivityStatus.DONE)}
            />
          </>
        )}
      </View>
    </View>
  );
}

import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ActivityStaffRef } from '@fonte/types';
import { getInitials } from '../lib/initials';

interface Props {
  responsible: ActivityStaffRef | null | undefined;
  /**
   * Story 220: só o coordenador da casa recebe `onPress` (atribuir/trocar). Sem
   * ele o badge é só leitura, não é botão.
   */
  onPress?: () => void;
  /** Sem rede a troca fica desabilitada (o motivo é escrito por quem renderiza). */
  disabled?: boolean;
}

function BadgeContent({ responsible }: { responsible: ActivityStaffRef | null | undefined }) {
  if (!responsible) {
    return (
      <>
        <View className="h-5 w-5 items-center justify-center rounded-full bg-gray-100">
          <Ionicons name="person-outline" size={12} color="#9ca3af" />
        </View>
        <Text className="text-xs text-gray-400">Sem responsável</Text>
      </>
    );
  }

  const initials = getInitials(responsible.name);
  return (
    <>
      <View className="h-5 w-5 items-center justify-center rounded-full bg-blue-100">
        {initials ? (
          <Text className="text-[9px] font-semibold uppercase text-blue-700">{initials}</Text>
        ) : (
          <Ionicons name="person" size={12} color="#1d4ed8" />
        )}
      </View>
      <Text className="text-xs text-gray-600">{responsible.name}</Text>
    </>
  );
}

/**
 * Mostra o responsável de uma atividade com avatar de iniciais + nome.
 * Sem responsável → ícone "person" esmaecido + rótulo "Sem responsável",
 * reforçando rascunhos/solicitações ainda sem dono.
 */
export function ResponsibleBadge({ responsible, onPress, disabled }: Props) {
  const label = responsible ? `Responsável: ${responsible.name}` : 'Sem responsável';

  if (!onPress) {
    return (
      <View className="flex-row items-center gap-1.5" accessibilityLabel={label}>
        <BadgeContent responsible={responsible} />
      </View>
    );
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={responsible ? `Trocar responsável: ${responsible.name}` : 'Definir responsável'}
      accessibilityState={{ disabled: !!disabled }}
      testID="responsible-badge-button"
      disabled={disabled}
      onPress={onPress}
      className="flex-row items-center gap-1.5 self-start"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <BadgeContent responsible={responsible} />
      <Ionicons name="swap-horizontal-outline" size={12} color="#6366f1" />
    </TouchableOpacity>
  );
}

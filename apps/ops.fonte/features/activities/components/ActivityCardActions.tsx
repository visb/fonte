import { View, Text, TouchableOpacity } from "react-native";
import { ActivityStatus } from "@fonte/types";
import type { Activity } from "@fonte/api-client";

/**
 * Ações de mudança de status do card de atividade.
 *
 * Mudar status **exige rede**: o endpoint não aceita `Idempotency-Key`, então a
 * ação não entra na outbox (story 171, decisão 4) — sem sinal ela fica
 * desabilitada com o motivo escrito, nunca com erro de axios na tela.
 */
interface Props {
  item: Activity;
  isCreator: boolean;
  isResponsible: boolean;
  /**
   * Coordenador da casa vendo uma solicitação (story 220): mostra "Aprovar
   * solicitação", que dispara `onChangeStatus(item, TODO)`. Quem decide se abre
   * o seletor de responsável é a page.
   */
  canApprove?: boolean;
  onChangeStatus: (activity: Activity, status: ActivityStatus) => void;
  /** Já há uma mudança de status em voo. */
  pending?: boolean;
  isOnline?: boolean;
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

/** Transições que o ops oferece, por situação e papel de quem está olhando. */
function transitionsFor(
  status: ActivityStatus,
  isCreator: boolean,
  isResponsible: boolean,
  canApprove: boolean,
): { label: string; color: string; to: ActivityStatus }[] {
  if (isCreator && status === ActivityStatus.DRAFT) {
    return [
      {
        label: "Enviar solicitação",
        color: "#2563eb",
        to: ActivityStatus.REQUESTED,
      },
    ];
  }
  if (status === ActivityStatus.REQUESTED) {
    const actions: { label: string; color: string; to: ActivityStatus }[] = [];
    // Devolver para rascunho (story 75): o criador desfaz o próprio envio.
    if (isCreator) {
      actions.push({
        label: "Devolver para rascunho",
        color: "#6b7280",
        to: ActivityStatus.DRAFT,
      });
    }
    // Aprovar (story 220): coordenador da casa. Criador-coordenador vê os dois.
    if (canApprove) {
      actions.push({
        label: "Aprovar solicitação",
        color: "#16a34a",
        to: ActivityStatus.TODO,
      });
    }
    return actions;
  }
  if (!isResponsible) return [];
  if (status === ActivityStatus.TODO) {
    return [{ label: "Iniciar", color: "#b45309", to: ActivityStatus.DOING }];
  }
  if (status === ActivityStatus.DOING) {
    return [
      {
        label: "Marcar Impedimento",
        color: "#dc2626",
        to: ActivityStatus.BLOCKED,
      },
      { label: "Concluir", color: "#16a34a", to: ActivityStatus.DONE },
    ];
  }
  if (status === ActivityStatus.BLOCKED) {
    return [
      { label: "Retomar", color: "#b45309", to: ActivityStatus.DOING },
      { label: "Concluir", color: "#16a34a", to: ActivityStatus.DONE },
    ];
  }
  return [];
}

export function ActivityCardActions({
  item,
  isCreator,
  isResponsible,
  canApprove = false,
  onChangeStatus,
  pending,
  isOnline = true,
}: Props) {
  const transitions = transitionsFor(
    item.status,
    isCreator,
    isResponsible,
    canApprove,
  );
  if (transitions.length === 0) return null;

  return (
    <View>
      <View className="flex-row flex-wrap gap-2 mt-2">
        {transitions.map((transition) => (
          <ActionButton
            key={transition.to}
            label={transition.label}
            color={transition.color}
            disabled={pending || !isOnline}
            onPress={() => onChangeStatus(item, transition.to)}
          />
        ))}
      </View>
      {!isOnline && (
        <Text className="text-xs text-gray-400 mt-1.5">
          Precisa de conexão para mudar a situação.
        </Text>
      )}
    </View>
  );
}

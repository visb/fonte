import { View, Text, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { REMOVABLE_RESIDENT_STATUSES, Role, type ResidentStatus } from "@fonte/types";
import { STATUS_CONFIG } from "@/lib/constants";
import { resolveAssetUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Props = {
  item: {
    id: string;
    name: string;
    status: string;
    photoThumbUrl?: string | null;
    photoUrl?: string | null;
    /** Story 203: repassada ao modal de baixa (limite da data de saída). */
    entryDate?: string | null;
  };
  /** Abre o menu de linha. Sem handler, o `⋮` não aparece. */
  onOpenMenu?: (item: Props["item"]) => void;
};

/**
 * Story 196 — quem pode dar baixa num filho.
 *
 * `PATCH /residents/:id` é `@Roles(ADMIN, COORDINATOR)`: o servo NÃO pode.
 * Esconder (e não desabilitar) é deliberado — sem o gate, o servo tocaria,
 * a mutation entraria na fila offline (que não conhece 403), o app diria
 * "salvo no aparelho" e horas depois o item morreria em `/sync` com um erro
 * de permissão que ele não tem como resolver.
 */
const REMOVAL_ROLES: Role[] = [Role.ADMIN, Role.COORDINATOR];

export function ResidentListItem({ item, onOpenMenu }: Props) {
  const { staff } = useAuth();
  const thumbUrl = resolveAssetUrl(item.photoThumbUrl ?? item.photoUrl);

  const canRemove =
    !!onOpenMenu &&
    !!staff?.user?.role &&
    REMOVAL_ROLES.includes(staff.user.role as Role) &&
    REMOVABLE_RESIDENT_STATUSES.includes(item.status as ResidentStatus);

  return (
    <TouchableOpacity
      className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex-row items-center"
      onPress={() => router.push(`/(app)/residents/${item.id}` as never)}
    >
      <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-3 overflow-hidden">
        {thumbUrl ? (
          <Image
            source={{ uri: thumbUrl }}
            className="w-10 h-10 rounded-full"
          />
        ) : (
          <Ionicons name="person-outline" size={20} color="#2563eb" />
        )}
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-gray-900">{item.name}</Text>
      </View>
      <View
        className="rounded-full px-2 py-0.5"
        style={{
          backgroundColor: `${STATUS_CONFIG[item.status]?.color ?? "#6b7280"}20`,
        }}
      >
        <Text
          className="text-xs font-medium"
          style={{ color: STATUS_CONFIG[item.status]?.color ?? "#6b7280" }}
        >
          {STATUS_CONFIG[item.status]?.label ?? item.status}
        </Text>
      </View>
      {canRemove ? (
        <TouchableOpacity
          accessibilityLabel={`Ações de ${item.name}`}
          className="pl-2 py-1"
          hitSlop={8}
          // `stopPropagation`: sem ele o toque sobe para a linha e o menu abre
          // junto com a navegação para a ficha.
          onPress={(event) => {
            event?.stopPropagation?.();
            onOpenMenu?.(item);
          }}
        >
          <Ionicons name="ellipsis-vertical" size={18} color="#6b7280" />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

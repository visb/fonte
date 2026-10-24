import { FlatList, View } from "react-native";
import type { ActivityStatus } from "@fonte/types";
import type { Activity } from "@fonte/api-client";
import { EmptyState } from "@/components/shared/EmptyState";
import { canQuickAddInStatus } from "@/features/activities/constants";
import type { ActivityColumnData } from "@/features/activities/lib/columns";
import { ActivityCard } from "./ActivityCard";
import { QuickAddCard } from "./QuickAddCard";

interface Props {
  column: ActivityColumnData;
  /** Largura da página no pager horizontal (uma coluna por tela). */
  width: number;
  role: string | null;
  houseId?: string | null;
  currentUserId?: string;
  onChangeStatus: (activity: Activity, status: ActivityStatus) => void;
  onPressActivity: (activity: Activity) => void;
  /** Abre o seletor de responsável (story 220). */
  onPressResponsible?: (activity: Activity) => void;
  pending?: boolean;
  isOnline?: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}

/**
 * Uma coluna do quadro em tela cheia (story 208): cards do status, quick-add no
 * rodapé quando o status permite e `EmptyState` quando está vazia.
 */
export function ActivityColumn({
  column,
  width,
  role,
  houseId,
  currentUserId,
  onChangeStatus,
  onPressActivity,
  onPressResponsible,
  pending,
  isOnline,
  refreshing,
  onRefresh,
}: Props) {
  const showQuickAdd = canQuickAddInStatus(column.status, { role, houseId });

  return (
    <View style={{ width }} testID={`activity-column-${column.status}`}>
      <FlatList
        data={column.data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 96 }}
        refreshing={refreshing}
        onRefresh={onRefresh}
        renderItem={({ item }) => (
          <ActivityCard
            item={item}
            currentUserId={currentUserId}
            onChangeStatus={onChangeStatus}
            onPress={onPressActivity}
            onPressResponsible={onPressResponsible}
            viewer={{ role, houseId }}
            pending={pending}
            isOnline={isOnline}
          />
        )}
        ListEmptyComponent={<EmptyState message="Nenhuma atividade" />}
        ListHeaderComponent={
          showQuickAdd ? (
            <QuickAddCard status={column.status} houseId={houseId} />
          ) : null
        }
      />
    </View>
  );
}

import { useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { router } from "expo-router";
import { PRESENT_RESIDENT_STATUSES } from "@fonte/types";
import { useAuth } from "@/lib/auth";
import { useResidentCountByHouse } from "@/features/residents/hooks/useResidents";
import { useHouseStaff } from "@/features/staff/hooks/useHouseStaff";
import { useMenuAccess } from "@/features/menu/hooks/useMenuAccess";
import { menuItemRoute } from "@/features/menu/constants";
import { WelcomeHeader } from "@/features/dashboard/components/WelcomeHeader";
import { StatCards } from "@/features/dashboard/components/StatCards";
import { QuickActions } from "@/features/dashboard/components/QuickActions";
import { SyncQueueBadge } from "@/features/sync/components/SyncQueueBadge";

export function DashboardPage() {
  const { staff } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: residents = [], refetch: refetchResidents } =
    useResidentCountByHouse(staff?.houseId);
  // Story 221: servos ativos da casa — mesma query (pré-carregada e persistida)
  // da lista da story 204, sem fetch novo.
  const { data: houseStaff = [], refetch: refetchStaff } = useHouseStaff(staff?.houseId);
  // Contagem e configurações da casa deixaram de ser recalculadas aqui: quem
  // decide o que o usuário alcança é o catálogo do menu (story 176).
  const { quickActions, canAccess } = useMenuAccess();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchResidents(), refetchStaff()]);
    setIsRefreshing(false);
  };

  const presentResidentsCount = residents.filter((resident) =>
    (PRESENT_RESIDENT_STATUSES as readonly string[]).includes(resident.status),
  ).length;

  const openResidents = canAccess("residents")
    ? () => router.push(menuItemRoute("residents") as never)
    : undefined;
  const openStaff = canAccess("staff")
    ? () => router.push(menuItemRoute("staff") as never)
    : undefined;

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      <WelcomeHeader name={staff?.name ?? "—"} houseName={staff?.house?.name} photoUrl={staff?.photoUrl} rank={staff?.rank} />
      <View className="px-4 py-4">
        {/* Fila de sincronização (story 170): só aparece quando há algo por subir. */}
        <SyncQueueBadge />
        <StatCards
          residentCount={presentResidentsCount}
          staffCount={houseStaff.length}
          onPressResidents={openResidents}
          onPressStaff={openStaff}
        />
        <QuickActions items={quickActions} />
      </View>
    </ScrollView>
  );
}

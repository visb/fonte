import { useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { PRESENT_RESIDENT_STATUSES } from "@fonte/types";
import { useAuth } from "@/lib/auth";
import { useResidentCountByHouse } from "@/features/residents/hooks/useResidents";
import { useIncidentsToday } from "@/features/incidents/hooks/useIncidents";
import { useMenuAccess } from "@/features/menu/hooks/useMenuAccess";
import { WelcomeHeader } from "@/features/dashboard/components/WelcomeHeader";
import { StatCards } from "@/features/dashboard/components/StatCards";
import { QuickActions } from "@/features/dashboard/components/QuickActions";
import { SyncQueueBadge } from "@/features/sync/components/SyncQueueBadge";

export function DashboardPage() {
  const { staff } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: residents = [], refetch: refetchResidents } =
    useResidentCountByHouse(staff?.houseId);
  const { data: incidents = [], refetch: refetchIncidents } =
    useIncidentsToday(staff?.houseId);
  // Contagem e configurações da casa deixaram de ser recalculadas aqui: quem
  // decide o que o usuário alcança é o catálogo do menu (story 176).
  const { quickActions } = useMenuAccess();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchResidents(), refetchIncidents()]);
    setIsRefreshing(false);
  };

  const presentResidentsCount = residents.filter((resident) =>
    (PRESENT_RESIDENT_STATUSES as readonly string[]).includes(resident.status),
  ).length;

  const todayIncidentsCount = incidents.filter((incident) => {
    const incidentDate = new Date(incident.date).toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];
    return incidentDate === today;
  }).length;

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
          incidentCount={todayIncidentsCount}
        />
        <QuickActions items={quickActions} />
      </View>
    </ScrollView>
  );
}

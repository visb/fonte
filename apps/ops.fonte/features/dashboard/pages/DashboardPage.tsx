import { useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { Role, PRESENT_RESIDENT_STATUSES } from "@fonte/types";
import { useAuth } from "@/lib/auth";
import { useResidentCountByHouse } from "@/features/residents/hooks/useResidents";
import { useIncidentsToday } from "@/features/incidents/hooks/useIncidents";
import { useHouseById } from "@/features/house-settings/hooks/useHouseSettings";
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
  const isCoordinator = staff?.user.role === Role.COORDINATOR;

  const { data: house } = useHouseById(staff?.houseId, {
    enabled: isCoordinator,
  });

  const isHouseCoordinator =
    isCoordinator && !!house && house.coordinatorId === staff.id;

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
      <WelcomeHeader name={staff?.name ?? "—"} houseName={staff?.house?.name} photoUrl={staff?.photoUrl} />
      <View className="px-4 py-4">
        {/* Fila de sincronização (story 170): só aparece quando há algo por subir. */}
        <SyncQueueBadge />
        <StatCards
          residentCount={presentResidentsCount}
          incidentCount={todayIncidentsCount}
        />
        <QuickActions
          showCensus={isCoordinator}
          showHouseSettings={isHouseCoordinator}
        />
      </View>
    </ScrollView>
  );
}

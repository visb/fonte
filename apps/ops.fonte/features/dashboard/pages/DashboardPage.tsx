import { useState } from "react";
import { View, ScrollView, RefreshControl } from "react-native";
import { useAuth } from "@/lib/auth";
import { useResidentCountByHouse } from "@/features/residents/hooks/useResidents";
import { useIncidentsToday } from "@/features/incidents/hooks/useIncidents";
import { WelcomeHeader } from "@/features/dashboard/components/WelcomeHeader";
import { StatCards } from "@/features/dashboard/components/StatCards";
import { QuickActions } from "@/features/dashboard/components/QuickActions";

export function DashboardPage() {
  const { staff } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: residents = [], refetch: refetchResidents } =
    useResidentCountByHouse(staff?.houseId);
  const { data: incidents = [], refetch: refetchIncidents } =
    useIncidentsToday(staff?.houseId);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchResidents(), refetchIncidents()]);
    setIsRefreshing(false);
  };

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
      <WelcomeHeader name={staff?.name ?? "—"} houseName={staff?.house?.name} />
      <View className="px-4 py-4">
        <StatCards
          residentCount={residents.length}
          incidentCount={todayIncidentsCount}
        />
        <QuickActions />
      </View>
    </ScrollView>
  );
}

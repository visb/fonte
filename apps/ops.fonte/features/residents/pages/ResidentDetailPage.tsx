import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useResidentById } from "@/features/residents/hooks/useResidents";

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="py-2.5 border-b border-gray-100 flex-row">
      <Text className="text-sm text-gray-500 w-36">{label}</Text>
      <Text className="text-sm text-gray-900 flex-1">{value || "—"}</Text>
    </View>
  );
}

function fmt(iso: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

export function ResidentDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: resident, isLoading, refetch } = useResidentById(id);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!resident) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">Filho não encontrado.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: resident.name }} />
      <ScrollView
        className="flex-1 bg-white"
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <View className="px-4 py-4">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Identificação
          </Text>
          <Row label="Nome" value={resident.name} />
          <Row label="CPF" value={resident.cpf} />
          <Row label="Data de nasc." value={fmt(resident.birthDate)} />
          <Row
            label="Gênero"
            value={
              resident.gender === "MALE"
                ? "Masculino"
                : resident.gender === "FEMALE"
                  ? "Feminino"
                  : null
            }
          />

          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-5 mb-1">
            Internamento
          </Text>
          <Row label="Casa" value={resident.house?.name} />
          <Row label="Entrada" value={fmt(resident.entryDate)} />
          <Row label="Telefone" value={resident.contactPhone} />

          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-5 mb-1">
            Saúde
          </Text>
          <Row label="Problemas de saúde" value={resident.healthIssues} />
          <Row
            label="Medicação contínua"
            value={resident.continuousMedication}
          />
        </View>
      </ScrollView>
    </>
  );
}

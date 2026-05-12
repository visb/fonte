import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { IncidentSeverity } from "@fonte/types";
import { useAuth } from "@/lib/auth";
import { useCreateIncident } from "@/features/incidents/hooks/useIncidents";
import { useResidentsByHouse } from "@/features/residents/hooks/useResidents";
import { SeveritySelector } from "@/features/incidents/components/SeveritySelector";
import { ResidentPicker } from "@/features/incidents/components/ResidentPicker";

const today = new Date().toISOString().split("T")[0];

const schema = z.object({
  date: z.string().min(1),
  severity: z.nativeEnum(IncidentSeverity),
  description: z.string().min(1, "Descreva a ocorrência"),
  residentId: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export function NewIncidentPage() {
  const { staff } = useAuth();

  const { data: residents = [] } = useResidentsByHouse(staff?.houseId);
  const mutation = useCreateIncident();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: today,
      severity: IncidentSeverity.MEDIUM,
      description: "",
      residentId: "",
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(
      {
        date: data.date,
        severity: data.severity,
        description: data.description,
        houseId: staff!.houseId!,
        responsibleId: staff!.id,
        residentId: data.residentId || null,
      },
      {
        onSuccess: () =>
          Alert.alert("Sucesso", "Ocorrência registrada.", [
            { text: "OK", onPress: () => router.back() },
          ]),
        onError: () =>
          Alert.alert("Erro", "Não foi possível registrar a ocorrência."),
      },
    );
  };

  return (
    <ScrollView className="flex-1 bg-white" keyboardShouldPersistTaps="handled">
      <View className="px-4 py-5 space-y-5">
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Data</Text>
          <Controller
            control={control}
            name="date"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50"
                value={value}
                onChangeText={onChange}
                placeholder="AAAA-MM-DD"
              />
            )}
          />
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-2">
            Severidade
          </Text>
          <Controller
            control={control}
            name="severity"
            render={({ field: { onChange, value } }) => (
              <SeveritySelector value={value} onChange={onChange} />
            )}
          />
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Descrição <Text className="text-red-500">*</Text>
          </Text>
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, value } }) => (
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50"
                placeholder="Descreva a ocorrência com detalhes..."
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                value={value}
                onChangeText={onChange}
              />
            )}
          />
          {errors.description && (
            <Text className="text-xs text-red-500 mt-1">
              {errors.description.message}
            </Text>
          )}
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Filho envolvido (opcional)
          </Text>
          <Controller
            control={control}
            name="residentId"
            render={({ field: { onChange, value } }) => (
              <ResidentPicker
                value={value ?? ""}
                residents={residents}
                onChange={onChange}
              />
            )}
          />
        </View>

        <View className="bg-gray-50 rounded-lg px-4 py-3">
          <Text className="text-xs text-gray-500">Responsável</Text>
          <Text className="text-sm font-medium text-gray-800 mt-0.5">
            {staff?.name}
          </Text>
        </View>

        <TouchableOpacity
          className="bg-red-600 rounded-lg py-3.5 items-center mt-2"
          onPress={handleSubmit(onSubmit)}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">
              Registrar ocorrência
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

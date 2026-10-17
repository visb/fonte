import { useState } from "react";
import { View, ScrollView, Alert, Text } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { router } from "expo-router";
import { MovementType, todayInSaoPaulo } from "@fonte/types";
import type { StoreroomItem } from "@fonte/api-client";
import { useAuth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";
import { useFieldSubmit } from "@/lib/offline/fieldSubmit";
import { createLocalId } from "@/lib/offline/localIds";
import {
  useStoreroomItems,
  useCreateMovement,
  useCreateStoreroomItem,
} from "@/features/storeroom/hooks/useStoreroom";
import { pastOrTodayDateSchema } from "@/lib/date";
import { DateInput } from "@/components/shared/DateInput";
import { MovementTypeSelector } from "@/features/storeroom/components/MovementTypeSelector";
import { ItemSearchInput } from "@/features/storeroom/components/ItemSearchInput";
import { QuantityField } from "@/features/storeroom/components/QuantityField";
import { NotesField } from "@/features/storeroom/components/NotesField";
import { ResponsibleDisplay } from "@/features/storeroom/components/ResponsibleDisplay";
import { SubmitMovementButton } from "@/features/storeroom/components/SubmitMovementButton";

const schema = z.object({
  itemId: z.string().min(1, "Selecione um item"),
  type: z.nativeEnum(MovementType),
  quantity: z
    .string()
    .min(1, "Informe a quantidade")
    .refine(
      (v) => !isNaN(Number(v)) && Number(v) > 0,
      "Quantidade deve ser maior que 0",
    ),
  notes: z.string().optional(),
  // Story 209: lançamento retroativo pode, futuro não.
  date: pastOrTodayDateSchema,
});
type FormData = z.infer<typeof schema>;

export function MovementPage() {
  const { staff } = useAuth();
  const [search, setSearch] = useState("");

  const { data: items = [] } = useStoreroomItems(staff?.houseId);
  const createItemMutation = useCreateStoreroomItem();
  const mutation = useCreateMovement();
  const submitItem = useFieldSubmit(createItemMutation);
  const submitMovement = useFieldSubmit(mutation);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      itemId: "",
      type: MovementType.IN,
      quantity: "",
      notes: "",
      // "Hoje" no fuso da operação, não o do aparelho (story 209).
      date: todayInSaoPaulo(),
    },
  });

  const currentType = watch("type");
  const currentItemId = watch("itemId");
  const selectedItem = items.find((i) => i.id === currentItemId);

  function handleSelectItem(item: StoreroomItem) {
    selectItem(item.id, item.name);
  }

  function handleSearchChange(text: string) {
    setSearch(text);
    setValue("itemId", "");
  }

  function selectItem(id: string, name: string) {
    setValue("itemId", id);
    setSearch(name);
  }

  function handleCreateNewItem(unit: string) {
    const name = search.trim();
    // Sem sinal o cadastro fica na fila e o id real só chega quando subir: o id
    // local é o que permite lançar a movimentação agora (story 171, decisão 2).
    const localId = createLocalId();

    submitItem(
      { name, unit, houseId: staff!.houseId!, localId },
      {
        onSent: (newItem) => selectItem(newItem.id, newItem.name),
        onQueued: () => selectItem(localId, name),
        onFailed: (err) =>
          Alert.alert(
            "Erro",
            getErrorMessage(err, "Não foi possível cadastrar o item."),
          ),
      },
    );
  }

  function backToList(successMsg: string) {
    router.replace({ pathname: "/(app)/storeroom", params: { successMsg } });
  }

  const onSubmit = (data: FormData) => {
    // Sem sinal o lançamento entra na fila e o envio só acontece depois: esperar
    // o `onSuccess` deixaria o operador travado no botão girando (story 169).
    submitMovement(
      {
        itemId: data.itemId,
        type: data.type,
        quantity: parseFloat(data.quantity),
        responsibleId: staff!.id,
        date: data.date,
        notes: data.notes || null,
        responsibleName: staff?.name,
      },
      {
        onSent: () => backToList("Movimentação registrada com sucesso."),
        onQueued: () =>
          backToList("Movimentação salva. Será enviada quando a conexão voltar."),
        onFailed: (err) =>
          Alert.alert(
            "Erro",
            getErrorMessage(err, "Não foi possível registrar a movimentação."),
          ),
      },
    );
  };

  return (
    <ScrollView className="flex-1 bg-white" keyboardShouldPersistTaps="handled">
      <View className="px-4 py-5 space-y-5">
        <Controller
          control={control}
          name="type"
          render={({ field: { onChange, value } }) => (
            <MovementTypeSelector value={value} onChange={onChange} />
          )}
        />

        <ItemSearchInput
          value={search}
          selectedItemId={currentItemId}
          selectedItem={selectedItem}
          items={items}
          onChangeText={handleSearchChange}
          onSelect={handleSelectItem}
          onConfirmNewItem={handleCreateNewItem}
          isCreatingItem={createItemMutation.isPending}
          error={errors.itemId?.message}
        />

        <Controller
          control={control}
          name="quantity"
          render={({ field: { onChange, value } }) => (
            <QuantityField
              value={value}
              onChange={onChange}
              unit={selectedItem?.unit}
              error={errors.quantity?.message}
            />
          )}
        />

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">Data</Text>
          <Controller
            control={control}
            name="date"
            render={({ field: { onChange, onBlur, value } }) => (
              <DateInput
                accessibilityLabel="Data"
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                maxDate={todayInSaoPaulo()}
                error={errors.date?.message}
              />
            )}
          />
        </View>

        <Controller
          control={control}
          name="notes"
          render={({ field: { onChange, value } }) => (
            <NotesField value={value} onChange={onChange} />
          )}
        />

        <ResponsibleDisplay name={staff?.name} />

        <SubmitMovementButton
          type={currentType}
          isPending={mutation.isPending}
          onPress={handleSubmit(onSubmit)}
        />
      </View>
    </ScrollView>
  );
}

import { useState } from "react";
import { View, ScrollView, Alert } from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { router } from "expo-router";
import { MovementType } from "@fonte/types";
import type { StoreroomItem } from "@fonte/api-client";
import { useAuth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";
import {
  useStoreroomItems,
  useCreateMovement,
  useCreateStoreroomItem,
} from "@/features/storeroom/hooks/useStoreroom";
import { toISODate } from "@/features/storeroom/utils";
import { MovementTypeSelector } from "@/features/storeroom/components/MovementTypeSelector";
import { ItemSearchInput } from "@/features/storeroom/components/ItemSearchInput";
import { DateField } from "@/features/storeroom/components/DateField";
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
  date: z.string(),
});
type FormData = z.infer<typeof schema>;

export function MovementPage() {
  const { staff } = useAuth();
  const [dateObj, setDateObj] = useState(new Date());
  const [search, setSearch] = useState("");

  const { data: items = [] } = useStoreroomItems(staff?.houseId);
  const createItemMutation = useCreateStoreroomItem();
  const mutation = useCreateMovement();

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
      date: toISODate(new Date()),
    },
  });

  const currentType = watch("type");
  const currentItemId = watch("itemId");
  const selectedItem = items.find((i) => i.id === currentItemId);

  function handleSelectItem(item: StoreroomItem) {
    setValue("itemId", item.id);
    setSearch(item.name);
  }

  function handleSearchChange(text: string) {
    setSearch(text);
    setValue("itemId", "");
  }

  function handleCreateNewItem(unit: string) {
    createItemMutation.mutate(
      { name: search.trim(), unit, houseId: staff!.houseId! },
      {
        onSuccess: (newItem) => {
          setValue("itemId", newItem.id);
          setSearch(newItem.name);
        },
        onError: (err) =>
          Alert.alert(
            "Erro",
            getErrorMessage(err, "Não foi possível cadastrar o item."),
          ),
      },
    );
  }

  const onSubmit = (data: FormData) => {
    mutation.mutate(
      {
        itemId: data.itemId,
        type: data.type,
        quantity: parseFloat(data.quantity),
        responsibleId: staff!.id,
        date: data.date,
        notes: data.notes || null,
      },
      {
        onSuccess: () =>
          router.replace({
            pathname: "/(app)/storeroom",
            params: { successMsg: "Movimentação registrada com sucesso." },
          }),
        onError: (err) =>
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

        <DateField
          value={dateObj}
          onChange={(date, iso) => {
            setDateObj(date);
            setValue("date", iso);
          }}
        />

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

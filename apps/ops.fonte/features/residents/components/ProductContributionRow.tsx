import { Controller, useWatch, type Control, type UseFormSetValue } from 'react-hook-form';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ProductContributionFormValues } from '../lib/productContributions';
import type { InventoryCatalogItem } from '../hooks/useProductContributions';
import { CatalogProductPicker } from './CatalogProductPicker';

interface LineErrors {
  inventoryItemId?: { message?: string };
  description?: { message?: string };
  quantity?: { message?: string };
}

interface Props {
  index: number;
  control: Control<ProductContributionFormValues>;
  setValue: UseFormSetValue<ProductContributionFormValues>;
  catalog: InventoryCatalogItem[];
  catalogLoading?: boolean;
  errors?: LineErrors;
  onRemove: () => void;
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: 'catalog' | 'avulso';
  onChange: (m: 'catalog' | 'avulso') => void;
}) {
  return (
    <View className="flex-row rounded-lg border border-gray-200 bg-white p-0.5">
      {(['catalog', 'avulso'] as const).map((m) => (
        <TouchableOpacity
          key={m}
          accessibilityLabel={m === 'catalog' ? 'Do catálogo' : 'Avulso'}
          onPress={() => onChange(m)}
          className={`rounded-md px-3 py-1.5 ${mode === m ? 'bg-blue-600' : ''}`}
        >
          <Text className={`text-xs font-medium ${mode === m ? 'text-white' : 'text-gray-500'}`}>
            {m === 'catalog' ? 'Do catálogo' : 'Avulso'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function ProductContributionRow({
  index,
  control,
  setValue,
  catalog,
  catalogLoading,
  errors,
  onRemove,
}: Props) {
  const mode = useWatch({ control, name: `products.${index}.mode` });
  const unit = useWatch({ control, name: `products.${index}.unit` });

  return (
    <View className="rounded-xl border border-gray-200 bg-gray-50 p-3 mb-3">
      <View className="flex-row items-center justify-between mb-3">
        <ModeToggle
          mode={mode}
          onChange={(m) => setValue(`products.${index}.mode`, m, { shouldValidate: false })}
        />
        <TouchableOpacity accessibilityLabel="Remover produto" onPress={onRemove} className="p-1">
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {mode === 'catalog' ? (
        <View>
          <Controller
            control={control}
            name={`products.${index}.inventoryItemId`}
            render={({ field: { value } }) => (
              <CatalogProductPicker
                value={value ?? ''}
                items={catalog}
                loading={catalogLoading}
                error={errors?.inventoryItemId?.message}
                onSelect={(item) => {
                  setValue(`products.${index}.inventoryItemId`, item.id, { shouldValidate: true });
                  setValue(`products.${index}.unit`, item.unit);
                }}
              />
            )}
          />
          <View className="flex-row items-center gap-2 mt-2">
            <Controller
              control={control}
              name={`products.${index}.quantity`}
              render={({ field: { onChange, value } }) => (
                <TextInput
                  accessibilityLabel="Quantidade"
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white"
                  placeholder="Quantidade"
                  keyboardType="numeric"
                  value={value ?? ''}
                  onChangeText={onChange}
                />
              )}
            />
            <Text className="text-sm text-gray-500 min-w-10">{unit || '—'}</Text>
          </View>
          {errors?.quantity?.message && (
            <Text className="text-xs text-red-500 mt-1">{errors.quantity.message}</Text>
          )}
        </View>
      ) : (
        <View>
          <Controller
            control={control}
            name={`products.${index}.description`}
            render={({ field: { onChange, value } }) => (
              <TextInput
                accessibilityLabel="Descrição"
                className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white"
                placeholder="Descrição (ex: cesta básica)"
                value={value ?? ''}
                onChangeText={onChange}
              />
            )}
          />
          {errors?.description?.message && (
            <Text className="text-xs text-red-500 mt-1">{errors.description.message}</Text>
          )}
          <View className="flex-row gap-2 mt-2">
            <Controller
              control={control}
              name={`products.${index}.quantity`}
              render={({ field: { onChange, value } }) => (
                <TextInput
                  accessibilityLabel="Quantidade"
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white"
                  placeholder="Qtd. (opcional)"
                  keyboardType="numeric"
                  value={value ?? ''}
                  onChangeText={onChange}
                />
              )}
            />
            <Controller
              control={control}
              name={`products.${index}.unit`}
              render={({ field: { onChange, value } }) => (
                <TextInput
                  accessibilityLabel="Unidade"
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-white"
                  placeholder="Unidade (opcional)"
                  value={value ?? ''}
                  onChangeText={onChange}
                />
              )}
            />
          </View>
          <Text className="text-xs text-amber-600 mt-2">Ficará pendente de detalhamento.</Text>
        </View>
      )}
    </View>
  );
}

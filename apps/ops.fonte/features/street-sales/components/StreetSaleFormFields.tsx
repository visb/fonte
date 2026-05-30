import { View, Text, TextInput } from 'react-native';
import { Controller } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import type { StreetSaleFormData } from '../pages/NewStreetSalePage';
import { ProductTypeSelector } from './ProductTypeSelector';
import { AmountField } from './AmountField';

type Props = {
  control: Control<StreetSaleFormData>;
  errors: FieldErrors<StreetSaleFormData>;
  totalAmount: string;
  onDatePress: () => void;
  dateLabel: string;
};

export function StreetSaleFormFields({ control, errors, totalAmount, onDatePress, dateLabel }: Props) {
  return (
    <View className="space-y-5">
      <View>
        <Text className="text-sm font-medium text-gray-700 mb-1.5">Data</Text>
        <Controller
          control={control}
          name="date"
          render={() => (
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50"
              value={dateLabel}
              editable={false}
              onTouchStart={onDatePress}
            />
          )}
        />
      </View>

      <Controller
        control={control}
        name="type"
        render={({ field: { value, onChange } }) => (
          <ProductTypeSelector value={value} onChange={onChange} />
        )}
      />

      <View>
        <Text className="text-sm font-medium text-gray-700 mb-1.5">
          Quantidade vendida <Text className="text-red-500">*</Text>
        </Text>
        <Controller
          control={control}
          name="quantity"
          render={({ field: { onChange, value } }) => (
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 bg-gray-50"
              keyboardType="number-pad"
              placeholder="0"
              value={value}
              onChangeText={onChange}
            />
          )}
        />
        {errors.quantity && (
          <Text className="text-xs text-red-500 mt-1">{errors.quantity.message}</Text>
        )}
      </View>

      <AmountField control={control} name="amountPix" label="PIX (R$)" errors={errors} />
      <AmountField control={control} name="amountCash" label="Dinheiro (R$)" errors={errors} />
      <AmountField control={control} name="amountCard" label="Cartão (R$)" errors={errors} />

      {parseFloat(totalAmount || '0') > 0 && (
        <View className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <Text className="text-xs text-green-700 mb-0.5">Total arrecadado</Text>
          <Text className="text-lg font-bold text-green-800">
            R$ {parseFloat(totalAmount).toFixed(2).replace('.', ',')}
          </Text>
        </View>
      )}
    </View>
  );
}

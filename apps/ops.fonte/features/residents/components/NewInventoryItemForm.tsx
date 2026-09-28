import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { CategorySelector } from '@/features/supply-room/components/CategorySelector';
import { newInventoryItemSchema, type NewInventoryItemInput } from '../lib/newInventoryItem';

export function NewInventoryItemForm({ name, onCancel, onSubmit, pending }: {
  name: string; onCancel: () => void; onSubmit: (input: NewInventoryItemInput) => void; pending?: boolean;
}) {
  const { control, watch, handleSubmit, formState: { errors } } = useForm<NewInventoryItemInput>({
    resolver: zodResolver(newInventoryItemSchema), defaultValues: { name, unit: '', target: 'storeroom' },
  });
  return <View className="gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
    <Text className="font-semibold">Novo produto</Text>
    {(['name', 'unit'] as const).map((field) => <View key={field}>
      <Controller control={control} name={field} render={({ field: { value, onChange } }) =>
        <TextInput accessibilityLabel={field === 'name' ? 'Nome do produto' : 'Unidade do produto'}
          placeholder={field === 'name' ? 'Nome' : 'Unidade'} value={value} onChangeText={onChange}
          className="border border-gray-300 rounded-lg p-3 bg-white" />} />
      {errors[field] && <Text className="text-red-600">{errors[field]?.message}</Text>}
    </View>)}
    <Controller control={control} name="target" render={({ field: { value, onChange } }) => <View className="flex-row gap-3">
      {(['storeroom', 'supply'] as const).map((target) => <TouchableOpacity key={target} accessibilityRole="radio"
        accessibilityState={{ checked: target === value }} onPress={() => onChange(target)}
        className={`rounded-lg p-3 ${value === target ? 'bg-blue-200' : 'bg-white'}`}>
        <Text>{target === 'storeroom' ? 'Dispensa' : 'Almoxarifado'}</Text>
      </TouchableOpacity>)}
    </View>} />
    {watch('target') === 'supply' && <Controller control={control} name="category" render={({ field }) =>
      <CategorySelector value={field.value ?? null} onChange={field.onChange}
        error={'category' in errors ? errors.category?.message : undefined} />} />}
    <View className="flex-row justify-end gap-3">
      <TouchableOpacity onPress={onCancel} disabled={pending}><Text>Cancelar cadastro</Text></TouchableOpacity>
      <TouchableOpacity onPress={handleSubmit(onSubmit)} disabled={pending}><Text>{pending ? 'Cadastrando...' : 'Cadastrar produto'}</Text></TouchableOpacity>
    </View>
  </View>;
}

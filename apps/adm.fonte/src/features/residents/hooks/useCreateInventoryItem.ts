import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SupplyRoomCategory } from '@fonte/types';
import { z } from 'zod';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { InventoryCatalogItem } from './useProductContributions';

const fields = { name: z.string().trim().min(1, 'Informe o nome'), unit: z.string().trim().min(1, 'Informe a unidade') };
export const inventoryItemSchema = z.discriminatedUnion('target', [
  z.object({ ...fields, target: z.literal('storeroom') }),
  z.object({ ...fields, target: z.literal('supply'), category: z.nativeEnum(SupplyRoomCategory, { required_error: 'Informe a categoria' }) }),
]);
export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;

export function useCreateInventoryItem(houseId: string) {
  const client = useQueryClient();
  return useMutation<InventoryCatalogItem, unknown, InventoryItemInput>({
    mutationFn: (input: InventoryItemInput) => input.target === 'supply'
      ? api.supplyRoom.createItem({ name: input.name, unit: input.unit, category: input.category, houseId })
      : api.storeroom.createItem({ name: input.name, unit: input.unit, houseId }),
    onSuccess: (item) => {
      client.setQueryData<InventoryCatalogItem[]>(queryKeys.inventory.catalog(houseId), (items = []) =>
        [...items.filter((row) => row.id !== item.id), { id: item.id, name: item.name, unit: item.unit }]
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      void client.invalidateQueries({ queryKey: queryKeys.inventory.catalog(houseId) });
    },
  });
}

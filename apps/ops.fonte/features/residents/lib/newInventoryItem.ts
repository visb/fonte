import { z } from 'zod';
import { SupplyRoomCategory } from '@fonte/types';

const fields = { name: z.string().trim().min(1, 'Informe o nome'), unit: z.string().trim().min(1, 'Informe a unidade') };
export const newInventoryItemSchema = z.discriminatedUnion('target', [
  z.object({ ...fields, target: z.literal('storeroom') }),
  z.object({ ...fields, target: z.literal('supply'), category: z.nativeEnum(SupplyRoomCategory, { required_error: 'Informe a categoria' }) }),
]);
export type NewInventoryItemInput = z.infer<typeof newInventoryItemSchema>;

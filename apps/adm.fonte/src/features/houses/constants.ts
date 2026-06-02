import { z } from 'zod';

export const BR_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

const optionalCapacity = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
  z.number().int().min(1).optional(),
);

export const houseSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  generalCapacity: optionalCapacity,
  staffCapacity: optionalCapacity,
  address: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().length(2).optional().or(z.literal('')),
  coordinatorId: z.string().uuid().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  isMotherHouse: z.boolean().optional(),
});

export type HouseFormData = z.infer<typeof houseSchema>;

export function sanitizeHouseData(data: HouseFormData) {
  return {
    ...data,
    generalCapacity: data.generalCapacity === undefined ? null : data.generalCapacity,
    staffCapacity: data.staffCapacity === undefined ? null : data.staffCapacity,
    address: data.address === '' ? null : data.address,
    city: data.city === '' ? null : data.city,
    state: data.state === '' ? null : data.state,
    coordinatorId: data.coordinatorId === '' ? null : data.coordinatorId,
    phone: data.phone === '' ? null : data.phone,
    isMotherHouse: data.isMotherHouse ?? false,
  };
}

export const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

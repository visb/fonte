import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MovementType } from '@fonte/types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

interface CreateMovementInput {
  itemId: string;
  type: MovementType;
  quantity: number;
  responsibleId: string;
  date: string;
  notes: string | null;
}

interface CreateItemInput {
  name: string;
  unit: string;
  houseId: string;
}

export function useStoreroomItems(houseId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.storeroom.items(houseId!),
    queryFn: () => api.storeroom.listItems({ houseId: houseId! }),
    enabled: !!houseId,
  });
}

export function useStoreroomMovements(itemId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.storeroom.movements(itemId!),
    queryFn: () => api.storeroom.listMovements({ itemId: itemId! }),
    enabled: !!itemId,
  });
}

export function useCreateMovement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMovementInput) => api.storeroom.createMovement(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.storeroom.allItems });
      queryClient.invalidateQueries({ queryKey: queryKeys.storeroom.allMovements });
    },
  });
}

export function useCreateStoreroomItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateItemInput) => api.storeroom.createItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.storeroom.allItems });
    },
  });
}

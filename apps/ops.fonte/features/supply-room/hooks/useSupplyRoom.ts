import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MovementType, SupplyRoomCategory } from '@fonte/types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

interface CreateSupplyMovementInput {
  itemId: string;
  type: MovementType;
  quantity: number;
  responsibleId: string;
  date: string;
  notes: string | null;
}

interface CreateSupplyItemInput {
  name: string;
  unit: string;
  category: SupplyRoomCategory;
  houseId: string;
}

export function useSupplyRoomItems(houseId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.supplyRoom.items(houseId!),
    queryFn: () => api.supplyRoom.listItems({ houseId: houseId! }),
    enabled: !!houseId,
  });
}

export function useSupplyRoomMovements(itemId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.supplyRoom.movements(itemId!),
    queryFn: () => api.supplyRoom.listMovements({ itemId: itemId! }),
    enabled: !!itemId,
  });
}

export function useCreateSupplyMovement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSupplyMovementInput) => api.supplyRoom.createMovement(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.supplyRoom.allItems });
      queryClient.invalidateQueries({ queryKey: queryKeys.supplyRoom.allMovements });
    },
  });
}

export function useCreateSupplyItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSupplyItemInput) => api.supplyRoom.createItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.supplyRoom.allItems });
    },
  });
}

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MovementType, SupplyRoomCategory } from '@fonte/types';
import type { SupplyRoomItem, SupplyRoomMovement } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  OUTBOX_MUTATION_KEYS,
  serializeMutationKey,
  useOutboxMutation,
  usePendingMutations,
} from '@/lib/offline/outbox';
import type {
  SupplyItemVariables,
  SupplyMovementVariables,
} from '@/lib/offline/mutationDefaults';

interface CreateSupplyMovementInput {
  itemId: string;
  type: MovementType;
  quantity: number;
  responsibleId: string;
  date: string;
  notes: string | null;
  /** Só para o update otimista (nome exibido no histórico enquanto pendente). */
  responsibleName?: string;
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

/** Fluxo de campo (despensa): vai para a outbox — ver `lib/offline/mutationDefaults.ts`. */
export function useCreateSupplyMovement() {
  return useOutboxMutation<CreateSupplyMovementInput, SupplyMovementVariables, SupplyRoomMovement>(
    OUTBOX_MUTATION_KEYS.supplyRoomCreateMovement,
    ({ responsibleName, ...data }) => ({ data, responsibleName }),
  );
}

export function useCreateSupplyItem() {
  return useOutboxMutation<CreateSupplyItemInput, SupplyItemVariables, SupplyRoomItem>(
    OUTBOX_MUTATION_KEYS.supplyRoomCreateItem,
    (data) => ({ data }),
  );
}

/**
 * Ids dos itens com movimentação ainda na fila — a lista marca esses itens como
 * pendentes de envio em vez de dar a impressão de que o lançamento já chegou.
 */
export function usePendingSupplyMovementItemIds(): Set<string> {
  const pending = usePendingMutations();
  const movementKey = serializeMutationKey(OUTBOX_MUTATION_KEYS.supplyRoomCreateMovement);

  return useMemo(
    () =>
      new Set(
        pending
          .filter((item) => item.mutationKey === movementKey)
          .map((item) => (item.variables as SupplyMovementVariables).data.itemId),
      ),
    [pending, movementKey],
  );
}

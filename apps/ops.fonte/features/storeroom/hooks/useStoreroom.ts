import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MovementType } from '@fonte/types';
import type { StoreroomItem, StoreroomMovement } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  OUTBOX_MUTATION_KEYS,
  useOutboxMutation,
  usePendingMutations,
  serializeMutationKey,
} from '@/lib/offline/outbox';
import type {
  StoreroomItemVariables,
  StoreroomMovementVariables,
} from '@/lib/offline/mutationDefaults';

interface CreateMovementInput {
  itemId: string;
  type: MovementType;
  quantity: number;
  responsibleId: string;
  date: string;
  notes: string | null;
  /** Só para o update otimista (nome exibido no histórico enquanto pendente). */
  responsibleName?: string;
}

interface CreateItemInput {
  name: string;
  unit: string;
  houseId: string;
  /**
   * Id `local:<uuid>` gerado pela tela quando o cadastro pode acontecer sem
   * sinal (story 171): é por ele que a movimentação seguinte referencia o item
   * enquanto o cadastro não sobe.
   */
  localId?: string;
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

/**
 * Movimentação de estoque é fluxo de campo: vai para a outbox (story 169). O
 * envio e a invalidação vivem em `lib/offline/mutationDefaults.ts` — aqui só a
 * `mutationKey` e as variáveis, que são o que sobrevive ao restart do app.
 */
export function useCreateMovement() {
  return useOutboxMutation<CreateMovementInput, StoreroomMovementVariables, StoreroomMovement>(
    OUTBOX_MUTATION_KEYS.storeroomCreateMovement,
    ({ responsibleName, ...data }) => ({ data, responsibleName }),
  );
}

export function useCreateStoreroomItem() {
  return useOutboxMutation<CreateItemInput, StoreroomItemVariables, StoreroomItem>(
    OUTBOX_MUTATION_KEYS.storeroomCreateItem,
    ({ localId, ...data }) => ({ data, localId }),
  );
}

/**
 * Ids dos itens com movimentação ainda na fila — a lista marca esses itens como
 * pendentes de envio em vez de dar a impressão de que o lançamento já chegou.
 */
export function usePendingMovementItemIds(): Set<string> {
  const pending = usePendingMutations();
  const movementKey = serializeMutationKey(OUTBOX_MUTATION_KEYS.storeroomCreateMovement);

  return useMemo(
    () =>
      new Set(
        pending
          .filter((item) => item.mutationKey === movementKey)
          .map((item) => (item.variables as StoreroomMovementVariables).data.itemId),
      ),
    [pending, movementKey],
  );
}

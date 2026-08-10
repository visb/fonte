import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateStreetSaleInput, UpdateStreetSaleInput } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { OUTBOX_MUTATION_KEYS, useOutboxMutation } from '@/lib/offline/outbox';
import type {
  StreetSaleCreateVariables,
  StreetSaleUpdateVariables,
} from '@/lib/offline/mutationDefaults';

export function useStreetSales(houseId?: string) {
  return useQuery({
    queryKey: queryKeys.streetSales.byHouse(houseId ?? ''),
    queryFn: () => api.streetSales.list({ houseId }),
    enabled: !!houseId,
  });
}

/** Venda de rua acontece fora da casa, quase sempre sem sinal: outbox (story 169). */
export function useCreateStreetSale() {
  return useOutboxMutation<CreateStreetSaleInput, StreetSaleCreateVariables>(
    OUTBOX_MUTATION_KEYS.streetSaleCreate,
    (data) => ({ data }),
  );
}

export function useUpdateStreetSale(houseId: string) {
  return useOutboxMutation<
    { id: string; data: UpdateStreetSaleInput },
    StreetSaleUpdateVariables
  >(OUTBOX_MUTATION_KEYS.streetSaleUpdate, ({ id, data }) => ({ id, data, houseId }));
}

export function useDeleteStreetSale(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.streetSales.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.streetSales.byHouse(houseId) });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateStreetSaleInput, UpdateStreetSaleInput } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useStreetSales(houseId?: string) {
  return useQuery({
    queryKey: queryKeys.streetSales.byHouse(houseId ?? ''),
    queryFn: () => api.streetSales.list({ houseId }),
    enabled: !!houseId,
  });
}

export function useCreateStreetSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStreetSaleInput) => api.streetSales.create(data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.streetSales.byHouse(vars.houseId) });
    },
  });
}

export function useUpdateStreetSale(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStreetSaleInput }) =>
      api.streetSales.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.streetSales.byHouse(houseId) });
    },
  });
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

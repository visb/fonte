import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useResidentsByHouse(houseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.residents.byHouse(houseId!),
    queryFn: () => api.residents.listByHouse(houseId!),
    enabled: !!houseId,
  });
}

export function useResidentCountByHouse(houseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.residents.countByHouse(houseId!),
    queryFn: () => api.residents.listByHouse(houseId!),
    enabled: !!houseId,
  });
}

export function useResidentById(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.residents.detail(id!),
    queryFn: () => api.residents.getById(id!),
    enabled: !!id,
  });
}

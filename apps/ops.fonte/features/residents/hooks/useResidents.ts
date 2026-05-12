import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useResidentsByHouse(houseId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.residents.byHouse(houseId!),
    queryFn: () => api.residents.listByHouse(houseId!),
    enabled: !!houseId,
  });
}

export function useResidentCountByHouse(houseId: string | null | undefined) {
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

export function useResidentRelatives(
  residentId: string | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.relatives.byResident(residentId!),
    queryFn: () => api.relatives.listByResident(residentId!),
    enabled: (options?.enabled ?? true) && !!residentId,
  });
}

export function useResidentAttachments(
  residentId: string | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.residents.attachments(residentId!),
    queryFn: () => api.residents.getAttachments(residentId!),
    enabled: (options?.enabled ?? true) && !!residentId,
  });
}

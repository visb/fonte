import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/** Ministérios da casa (story 205: store local de filho, abre offline). */
export function useHouseMinistries(
  houseId: string | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.houses.ministries(houseId!),
    queryFn: () => api.houses.listMinistries(houseId!),
    enabled: (options?.enabled ?? true) && !!houseId,
  });
}

/**
 * Troca o ministério do filho pela ficha (story 205). Exige rede (decisão 9) —
 * não é fluxo de campo, não entra na fila offline. O backend recusa (400) filho
 * fora de acolhimento ou ministério de outra casa.
 */
export function useChangeResidentMinistry(residentId: string, houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ministryId: string | null) => api.residents.update(residentId, { ministryId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.detail(residentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.houses.ministries(houseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ministries.byHouse(houseId) });
    },
  });
}

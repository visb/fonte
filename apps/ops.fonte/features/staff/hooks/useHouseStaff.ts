import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Servos da casa (story 204). Uma key só — `queryKeys.staff.byHouse` — para a
 * lista *Servos* e os seletores de líder dos ministérios: o cache é
 * compartilhado, pré-carregado no aquecimento da casa e persistido offline.
 *
 * Sem casa (servo de grupo de apoio) não há query.
 */
export function useHouseStaff(houseId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.staff.byHouse(houseId ?? ''),
    queryFn: () => api.houses.listStaff(houseId as string),
    enabled: !!houseId,
  });
}

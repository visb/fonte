import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProductContributionLineInput } from '@fonte/api-client';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Item do catálogo unificado de inventário (story 111) exposto ao seletor de
 * contribuição em produtos. Só o essencial p/ a UI: id (vira `inventoryItemId`),
 * nome e unidade (preenchida automaticamente ao escolher o item).
 */
export interface InventoryCatalogItem {
  id: string;
  name: string;
  unit: string;
}

/**
 * Catálogo unificado da casa: almoxarifado (`storeroom`) + dispensa (`supply`)
 * num único array ordenado por nome. O backend guarda os dois em `inventory_items`
 * (story 111), então qualquer id é um `inventoryItemId` válido na declaração.
 */
export function useInventoryCatalog(
  houseId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.inventory.catalog(houseId!),
    queryFn: async (): Promise<InventoryCatalogItem[]> => {
      const [storeroom, supply] = await Promise.all([
        api.storeroom.listItems({ houseId: houseId! }),
        api.supplyRoom.listItems({ houseId: houseId! }),
      ]);
      return [...storeroom, ...supply]
        .map((i) => ({ id: i.id, name: i.name, unit: i.unit }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    },
    enabled: (options?.enabled ?? true) && !!houseId,
  });
}

/** Carnê do filho (parcelas). Usado para localizar a parcela corrente (story 114). */
export function useResidentReceivables(
  residentId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.residents.receivables(residentId!),
    queryFn: () => api.residents.getReceivables(residentId!),
    enabled: (options?.enabled ?? true) && !!residentId,
  });
}

/** Contribuições em produtos já declaradas numa parcela (story 112). */
export function useResidentProductContributions(
  residentId: string | null | undefined,
  receivableId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.residents.productContributions(residentId!, receivableId!),
    queryFn: () => api.residents.getProductContributions(residentId!, receivableId!),
    enabled: (options?.enabled ?? true) && !!residentId && !!receivableId,
  });
}

/**
 * Declara uma ou mais linhas de contribuição em produtos numa parcela (story 112).
 * Independe do pagamento em dinheiro. Ao concluir, invalida o carnê, as
 * contribuições da parcela e o detalhe do filho.
 */
export function useDeclareProductContribution(residentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      receivableId,
      lines,
    }: {
      receivableId: string;
      lines: ProductContributionLineInput[];
    }) => api.residents.declareProductContributions(residentId, receivableId, { lines }),
    onSuccess: (_data, { receivableId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.receivables(residentId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.residents.productContributions(residentId, receivableId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.detail(residentId) });
    },
  });
}

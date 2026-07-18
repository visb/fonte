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
export function useInventoryCatalog(houseId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.inventory.catalog(houseId),
    queryFn: async (): Promise<InventoryCatalogItem[]> => {
      // A query só dispara com `houseId` presente (gate no `enabled`); a
      // asserção documenta a invariante para o TS dentro do queryFn.
      if (!houseId) return [];
      const [storeroom, supply] = await Promise.all([
        api.storeroom.listItems({ houseId }),
        api.supplyRoom.listItems({ houseId }),
      ]);
      return [...storeroom, ...supply]
        .map((i) => ({ id: i.id, name: i.name, unit: i.unit }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    },
    enabled: (options?.enabled ?? true) && !!houseId,
  });
}

/**
 * Declara uma ou mais linhas de contribuição em produtos numa parcela (story 112).
 * Independe do pagamento em dinheiro. Ao concluir, invalida o carnê e o detalhe
 * do acolhido para refletir as contribuições recém-declaradas.
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.receivables(residentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.detail(residentId) });
    },
  });
}

import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import type { InventoryCatalogItem } from '@/features/residents/hooks/useProductContributions';
import type { ProductContributionDeclareVariables, StoreroomItemVariables } from './mutationDefaults';
import { isLocalId, resolveLocalId, UnresolvedLocalIdError } from './localIds';

export function updateCatalogItem(client: QueryClient, variables: StoreroomItemVariables,
  source: InventoryCatalogItem['source'], item?: { id: string; name: string; unit: string }) {
  client.setQueryData<InventoryCatalogItem[]>(queryKeys.inventory.catalog(variables.data.houseId), (items = []) => {
    const remaining = items.filter((row) => row.id !== variables.localId && row.id !== item?.id);
    return (item ? [...remaining, { id: item.id, name: item.name, unit: item.unit, source }] : remaining)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  });
}

export function snapshotCatalogNames(client: QueryClient, variables: ProductContributionDeclareVariables) {
  const items = client.getQueryData<InventoryCatalogItem[]>(queryKeys.inventory.catalog(variables.houseId)) ?? [];
  variables.itemNames ??= Object.fromEntries(items.filter((item) =>
    isLocalId(item.id) && variables.lines.some((line) => line.inventoryItemId === item.id))
    .map((item) => [item.id, item.name]));
}

async function waitForCatalogCreation(client: QueryClient, localId: string) {
  const pending = () => client.getMutationCache().getAll().some((mutation) =>
    mutation.state.status === 'pending' &&
    (mutation.state.variables as { localId?: string } | undefined)?.localId === localId);
  if (!pending()) return;
  // Mutations restauradas de versões anteriores preservam o escopo antigo.
  // Sem rede, pausar normalmente; online, esperar o cadastro de outro escopo.
  if (!onlineManager.isOnline()) throw new TypeError('Network request failed');
  await new Promise<void>((resolve) => {
    const unsubscribe = client.getMutationCache().subscribe(() => {
      if (!pending()) { unsubscribe(); resolve(); }
    });
    if (!pending()) { unsubscribe(); resolve(); }
  });
}

export async function resolveContributionLines(variables: ProductContributionDeclareVariables, client?: QueryClient) {
  return Promise.all(variables.lines.map(async (line) => {
    if (!line.inventoryItemId) return line;
    if (client && isLocalId(line.inventoryItemId)) await waitForCatalogCreation(client, line.inventoryItemId);
    try {
      return { ...line, inventoryItemId: await resolveLocalId(line.inventoryItemId) };
    } catch (error) {
      if (error instanceof UnresolvedLocalIdError && variables.itemNames?.[line.inventoryItemId]) {
        error.message = `O produto «${variables.itemNames[line.inventoryItemId]}» ainda não foi enviado. Reenvie o cadastro do produto primeiro.`;
      }
      throw error;
    }
  }));
}

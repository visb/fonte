import type { QueryClient } from '@tanstack/react-query';
import type { HouseProductContributionView, ReceivableProductContribution } from '@fonte/types';
import type { Resident } from '@fonte/api-client';
import { queryKeys } from '@/lib/queryKeys';
import type { ProductContributionDeclareVariables } from './mutationDefaults';
import { outboxEntityId } from './outbox';

export const isPendingContribution = (line: ReceivableProductContribution) => line.id.startsWith('outbox:');

export function mergePendingContributions(
  server: HouseProductContributionView[], cached: HouseProductContributionView[] = [],
): HouseProductContributionView[] {
  const groups = new Map(server.map((group) => [group.receivableId, { ...group, lines: [...group.lines] }]));
  for (const group of cached) {
    const pending = group.lines.filter(isPendingContribution);
    if (!pending.length) continue;
    const next = groups.get(group.receivableId) ?? { ...group, lines: [] };
    next.lines.push(...pending.filter((line) => !next.lines.some((existing) => existing.id === line.id)));
    groups.set(group.receivableId, next);
  }
  return [...groups.values()].sort((a, b) => a.residentName.localeCompare(b.residentName, 'pt-BR'));
}

export function applyProductContribution(client: QueryClient, variables: ProductContributionDeclareVariables): void {
  const key = queryKeys.houses.productContributions(variables.houseId, variables.referenceMonth);
  const resident = client.getQueryData<Resident[]>(queryKeys.residents.byHouse(variables.houseId))
    ?.find((row) => row.id === variables.residentId)
    ?? client.getQueryData<Resident>(queryKeys.residents.detail(variables.residentId));
  const group: HouseProductContributionView = {
    residentId: variables.residentId, residentName: resident?.name ?? 'Filho',
    receivableId: variables.receivableId, referenceMonth: variables.referenceMonth,
    lines: variables.lines.map((line, index) => ({
      id: `${outboxEntityId(variables.idempotencyKey!)}:${index}`,
      receivableId: variables.receivableId, inventoryItemId: line.inventoryItemId ?? null,
      inventoryMovementId: null, description: line.description ?? null,
      quantity: line.quantity ?? null, unit: line.unit ?? null,
      pendingDetailing: !line.inventoryItemId, createdByName: null, createdAt: new Date().toISOString(),
    })),
  };
  client.setQueryData<HouseProductContributionView[]>(key, (rows = []) => mergePendingContributions(rows, [group]));
}

/** Remove somente esta declaração; outras mutations da mesma parcela ficam intactas. */
export function settleProductContribution(
  client: QueryClient, variables: ProductContributionDeclareVariables, confirmed: ReceivableProductContribution[] = [],
): void {
  const prefix = `${outboxEntityId(variables.idempotencyKey!)}:`;
  client.setQueryData<HouseProductContributionView[]>(
    queryKeys.houses.productContributions(variables.houseId, variables.referenceMonth),
    (rows) => rows?.map((group) => group.receivableId !== variables.receivableId ? group : {
      ...group, lines: [...group.lines.filter((line) => !line.id.startsWith(prefix) && !confirmed.some((saved) => saved.id === line.id)), ...confirmed],
    }).filter((group) => group.lines.length > 0),
  );
}

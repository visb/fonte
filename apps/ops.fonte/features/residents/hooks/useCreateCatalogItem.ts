import { Alert } from 'react-native';
import { useCreateStoreroomItem } from '@/features/storeroom/hooks/useStoreroom';
import { useCreateSupplyItem } from '@/features/supply-room/hooks/useSupplyRoom';
import { useFieldSubmit } from '@/lib/offline/fieldSubmit';
import { createLocalId } from '@/lib/offline/localIds';
import { getErrorMessage } from '@/lib/errors';
import { useIsOnline } from '@/lib/offline/network';
import type { InventoryCatalogItem } from './useProductContributions';
import type { NewInventoryItemInput } from '../lib/newInventoryItem';

export type CreateCatalogItem = (input: NewInventoryItemInput, onCreated: (item: InventoryCatalogItem) => void) => void;

export function useCreateCatalogItem(houseId: string) {
  const online = useIsOnline();
  const storeroom = useCreateStoreroomItem();
  const supply = useCreateSupplyItem();
  const submitStoreroom = useFieldSubmit(storeroom);
  const submitSupply = useFieldSubmit(supply);
  const create: CreateCatalogItem = (input, onCreated) => {
    const localId = createLocalId();
    const { name, unit, target } = input;
    const handlers = {
      onSent: (item: { id: string; name: string; unit: string }) => onCreated({ ...item, source: target }),
      onQueued: () => onCreated({ id: localId, name, unit, source: target }),
      onFailed: (error: unknown) => Alert.alert('Erro', getErrorMessage(error, 'Não foi possível cadastrar o produto.')),
    };
    if (input.target === 'supply') submitSupply({ name, unit, category: input.category, houseId, localId }, handlers);
    else submitStoreroom({ name, unit, houseId, localId }, handlers);
  };
  return { create, isPending: online && (storeroom.isPending || supply.isPending) };
}

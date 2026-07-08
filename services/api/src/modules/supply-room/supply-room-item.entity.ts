import { ChildEntity, Column } from 'typeorm';
import { SupplyRoomCategory } from '@fonte/types';
import { InventoryItem, InventoryKind } from '../inventory/inventory-item.entity';

/**
 * Item de dispensa — filha `SUPPLY_ROOM` do catálogo unificado
 * (`inventory_items`). Adiciona a categoria, específica da dispensa.
 */
@ChildEntity(InventoryKind.SUPPLY_ROOM)
export class SupplyRoomItem extends InventoryItem {
  @Column({ type: 'enum', enum: SupplyRoomCategory })
  category: SupplyRoomCategory;
}

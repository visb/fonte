import { ChildEntity } from 'typeorm';
import { InventoryMovement } from '../inventory/inventory-movement.entity';
import { InventoryKind } from '../inventory/inventory-item.entity';

/**
 * Movimento de dispensa — filha `SUPPLY_ROOM` de `inventory_movements`.
 * O discriminador garante que o módulo supply-room só enxergue seus movimentos.
 */
@ChildEntity(InventoryKind.SUPPLY_ROOM)
export class SupplyRoomMovement extends InventoryMovement {}

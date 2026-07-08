import { ChildEntity } from 'typeorm';
import { InventoryMovement } from '../inventory/inventory-movement.entity';
import { InventoryKind } from '../inventory/inventory-item.entity';

/**
 * Movimento de almoxarifado — filha `STOREROOM` de `inventory_movements`.
 * O discriminador garante que o módulo storeroom só enxergue seus movimentos.
 */
@ChildEntity(InventoryKind.STOREROOM)
export class StoreroomMovement extends InventoryMovement {}

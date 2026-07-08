import { ChildEntity, Column } from 'typeorm';
import { InventoryItem, InventoryKind } from '../inventory/inventory-item.entity';

/**
 * Item de almoxarifado — filha `STOREROOM` do catálogo unificado
 * (`inventory_items`). Adiciona os campos de média semanal de consumo,
 * específicos do almoxarifado.
 */
@ChildEntity(InventoryKind.STOREROOM)
export class StoreroomItem extends InventoryItem {
  @Column({ name: 'weekly_average_usage', type: 'numeric', precision: 10, scale: 3, default: 0 })
  weeklyAverageUsage: number;

  @Column({ name: 'weekly_average_calculated_at', type: 'timestamp', nullable: true })
  weeklyAverageCalculatedAt: Date | null;

  @Column({ name: 'weekly_average_window_start', type: 'date', nullable: true })
  weeklyAverageWindowStart: string | null;

  @Column({ name: 'weekly_average_window_end', type: 'date', nullable: true })
  weeklyAverageWindowEnd: string | null;
}

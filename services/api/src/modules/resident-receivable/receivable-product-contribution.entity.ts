import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ResidentReceivable } from './resident-receivable.entity';
import { InventoryItem } from '../inventory/inventory-item.entity';
import { InventoryMovement } from '../inventory/inventory-movement.entity';
import { Staff } from '../staff/staff.entity';

/**
 * Contribuição em produtos declarada numa parcela do carnê (`ResidentReceivable`),
 * story 112. Uma linha por produto. Dois modos mutuamente exclusivos:
 *
 *  - **Catálogo** (`inventory_item_id` preenchido): referencia o catálogo unificado
 *    ([[111]], `inventory_items`) e gera um movimento IN em `inventory_movements`
 *    (o vínculo fica em `inventory_movement_id`). `quantity`/`unit` são o snapshot.
 *  - **Avulso** (`description` preenchida): texto livre (ex.: "cesta básica"),
 *    sem item nem movimento; `pending_detailing = true` (logística distrincha
 *    depois). Não mexe no estoque.
 *
 * Sem estorno (`BUSINESS_RULES.md`): remover uma linha de catálogo gera um
 * movimento de correção (OUT) — nunca apaga o IN original.
 */
@Entity('receivable_product_contributions')
export class ReceivableProductContribution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ResidentReceivable, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receivable_id' })
  receivable: ResidentReceivable;

  @Column({ name: 'receivable_id', type: 'uuid' })
  receivableId: string;

  @ManyToOne(() => InventoryItem, { nullable: true, eager: false })
  @JoinColumn({ name: 'inventory_item_id' })
  inventoryItem: InventoryItem | null;

  @Column({ name: 'inventory_item_id', type: 'uuid', nullable: true })
  inventoryItemId: string | null;

  @ManyToOne(() => InventoryMovement, { nullable: true, eager: false })
  @JoinColumn({ name: 'inventory_movement_id' })
  inventoryMovement: InventoryMovement | null;

  @Column({ name: 'inventory_movement_id', type: 'uuid', nullable: true })
  inventoryMovementId: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 3, nullable: true })
  quantity: number | null;

  @Column({ type: 'varchar', nullable: true })
  unit: string | null;

  @Column({ name: 'pending_detailing', type: 'boolean', default: false })
  pendingDetailing: boolean;

  @ManyToOne(() => Staff, { nullable: true, eager: false })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: Staff | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

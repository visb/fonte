import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  TableInheritance,
  UpdateDateColumn,
} from 'typeorm';
import { MovementType } from '@fonte/types';
import { InventoryItem, InventoryKind } from './inventory-item.entity';
import { Staff } from '../staff/staff.entity';

/**
 * Movimentos unificados do inventário (`inventory_movements`).
 *
 * Campos comuns a almoxarifado e dispensa. As entidades filhas
 * (`StoreroomMovement`, `SupplyRoomMovement`) apenas fixam o discriminador
 * `kind`, garantindo que cada módulo enxergue só os seus movimentos.
 */
@Entity('inventory_movements')
@TableInheritance({ column: { type: 'enum', enum: InventoryKind, name: 'kind' } })
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'item_id' })
  itemId: string;

  @ManyToOne(() => InventoryItem, { eager: false })
  @JoinColumn({ name: 'item_id' })
  item: InventoryItem;

  @Column({ type: 'enum', enum: MovementType })
  type: MovementType;

  @Column({ type: 'numeric', precision: 10, scale: 3 })
  quantity: number;

  @Column({ name: 'responsible_id' })
  responsibleId: string;

  @ManyToOne(() => Staff, { eager: false })
  @JoinColumn({ name: 'responsible_id' })
  responsible: Staff;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'date' })
  date: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

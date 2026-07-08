import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  TableInheritance,
  UpdateDateColumn,
} from 'typeorm';
import { House } from '../house/house.entity';

/**
 * Discriminador do catálogo de inventário unificado.
 *
 * Interno ao backend (não exposto em contratos de saída): o `kind` é usado
 * apenas pela persistência (single-table inheritance) para separar almoxarifado
 * (`STOREROOM`) e dispensa (`SUPPLY_ROOM`) na mesma tabela `inventory_items`.
 */
export enum InventoryKind {
  STOREROOM = 'STOREROOM',
  SUPPLY_ROOM = 'SUPPLY_ROOM',
}

/**
 * Catálogo unificado de itens de inventário (`inventory_items`).
 *
 * Campos comuns a almoxarifado e dispensa. Os campos específicos de cada tipo
 * vivem nas entidades filhas (`StoreroomItem`, `SupplyRoomItem`) via single-table
 * inheritance com o discriminador `kind`.
 */
@Entity('inventory_items')
@TableInheritance({ column: { type: 'enum', enum: InventoryKind, name: 'kind' } })
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar' })
  unit: string;

  @Column({ name: 'house_id' })
  houseId: string;

  @ManyToOne(() => House, { eager: false })
  @JoinColumn({ name: 'house_id' })
  house: House;

  @Column({ name: 'current_quantity', type: 'numeric', precision: 10, scale: 3, default: 0 })
  currentQuantity: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

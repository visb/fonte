import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MovementType } from '@fonte/types';
import { StoreroomItem } from './storeroom.entity';
import { Staff } from '../staff/staff.entity';

@Entity('storeroom_movements')
export class StoreroomMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'item_id' })
  itemId: string;

  @ManyToOne(() => StoreroomItem, { eager: false })
  @JoinColumn({ name: 'item_id' })
  item: StoreroomItem;

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

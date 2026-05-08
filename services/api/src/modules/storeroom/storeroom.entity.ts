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
import { House } from '../house/house.entity';

@Entity('storeroom_items')
export class StoreroomItem {
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

  @Column({ name: 'weekly_average_usage', type: 'numeric', precision: 10, scale: 3, default: 0 })
  weeklyAverageUsage: number;

  @Column({ name: 'weekly_average_calculated_at', type: 'timestamp', nullable: true })
  weeklyAverageCalculatedAt: Date | null;

  @Column({ name: 'weekly_average_window_start', type: 'date', nullable: true })
  weeklyAverageWindowStart: string | null;

  @Column({ name: 'weekly_average_window_end', type: 'date', nullable: true })
  weeklyAverageWindowEnd: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

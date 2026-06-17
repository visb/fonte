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
import { ActivityStatus } from '@fonte/types';
import { House } from '../house/house.entity';
import { Staff } from '../staff/staff.entity';
import { User } from '../user/user.entity';

@Entity('activities')
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: ActivityStatus, default: ActivityStatus.DRAFT })
  status: ActivityStatus;

  @Column({ name: 'house_id', type: 'uuid', nullable: true })
  houseId: string | null;

  @ManyToOne(() => House, { eager: false, nullable: true })
  @JoinColumn({ name: 'house_id' })
  house: House | null;

  @Column({ name: 'responsible_staff_id', type: 'uuid', nullable: true })
  responsibleStaffId: string | null;

  @ManyToOne(() => Staff, { eager: false, nullable: true })
  @JoinColumn({ name: 'responsible_staff_id' })
  responsible: Staff | null;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

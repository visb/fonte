import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Ministry } from './ministry.entity';
import { Staff } from '../staff/staff.entity';

@Entity('ministry_staff')
@Unique(['ministryId', 'staffId'])
export class MinistryStaff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ministry_id' })
  ministryId: string;

  @ManyToOne(() => Ministry, (m) => m.staffMembers, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ministry_id' })
  ministry: Ministry;

  @Column({ name: 'staff_id' })
  staffId: string;

  @ManyToOne(() => Staff, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staff_id' })
  staff: Staff;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

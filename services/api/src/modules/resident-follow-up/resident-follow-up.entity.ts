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
import { FollowUpAccessLevel, FollowUpType } from '@fonte/types';
import { Resident } from '../resident/resident.entity';
import { Staff } from '../staff/staff.entity';

@Entity('resident_follow_ups')
export class ResidentFollowUp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Resident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resident_id' })
  resident: Resident;

  @Column({ name: 'resident_id' })
  residentId: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'enum', enum: FollowUpType })
  type: FollowUpType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'access_level',
    type: 'enum',
    enum: FollowUpAccessLevel,
    default: FollowUpAccessLevel.ALL,
  })
  accessLevel: FollowUpAccessLevel;

  @ManyToOne(() => Staff, { nullable: true, eager: false })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: Staff | null;

  @Column({ name: 'created_by_id', nullable: true, type: 'uuid' })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

import {
  Column,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Resident } from '../resident/resident.entity';

@Entity('resident_usage_sessions')
export class ResidentUsageSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Resident, { eager: false })
  @JoinColumn({ name: 'resident_id' })
  resident: Resident;

  @Column({ name: 'resident_id' })
  residentId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'seconds_used', type: 'integer', default: 0 })
  secondsUsed: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

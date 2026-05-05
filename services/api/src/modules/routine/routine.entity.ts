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
import { Staff } from '../staff/staff.entity';
import { Resident } from '../resident/resident.entity';

@Entity('routine_entries')
export class RoutineEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'house_id' })
  houseId: string;

  @ManyToOne(() => House, { eager: false })
  @JoinColumn({ name: 'house_id' })
  house: House;

  @Column({ name: 'responsible_id' })
  responsibleId: string;

  @ManyToOne(() => Staff, { eager: false })
  @JoinColumn({ name: 'responsible_id' })
  responsible: Staff;

  @Column({ name: 'resident_id', nullable: true, type: 'uuid' })
  residentId: string | null;

  @ManyToOne(() => Resident, { eager: false, nullable: true })
  @JoinColumn({ name: 'resident_id' })
  resident: Resident | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

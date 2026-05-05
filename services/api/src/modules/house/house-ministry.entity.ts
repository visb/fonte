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
import { House } from './house.entity';
import { Ministry } from '../ministry/ministry.entity';
import { Staff } from '../staff/staff.entity';

@Entity('house_ministries')
@Unique(['houseId', 'ministryId'])
export class HouseMinistry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'house_id' })
  houseId: string;

  @ManyToOne(() => House, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'house_id' })
  house: House;

  @Column({ name: 'ministry_id' })
  ministryId: string;

  @ManyToOne(() => Ministry, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ministry_id' })
  ministry: Ministry;

  @Column({ name: 'leader_id', nullable: true, type: 'uuid' })
  leaderId: string | null;

  @ManyToOne(() => Staff, { eager: false, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'leader_id' })
  leader: Staff | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

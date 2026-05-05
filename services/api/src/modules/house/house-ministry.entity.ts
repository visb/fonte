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

  @Column({ name: 'leader_type', nullable: true, type: 'varchar', length: 10 })
  leaderType: 'STAFF' | 'RESIDENT' | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

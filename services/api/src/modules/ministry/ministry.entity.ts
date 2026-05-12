import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { House } from '../house/house.entity';
import { MinistryStaff } from './ministry-staff.entity';
import { MinistryTask } from './ministry-task.entity';

@Entity('ministries')
export class Ministry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'house_id' })
  houseId: string;

  @ManyToOne(() => House, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'house_id' })
  house: House;

  @Column({ name: 'leader_id', nullable: true, type: 'uuid' })
  leaderId: string | null;

  @Column({ name: 'leader_type', nullable: true, type: 'varchar', length: 10 })
  leaderType: 'STAFF' | 'RESIDENT' | null;

  @OneToMany(() => MinistryStaff, (ms) => ms.ministry, { eager: false })
  staffMembers: MinistryStaff[];

  @OneToMany(() => MinistryTask, (mt) => mt.ministry, { eager: false })
  tasks: MinistryTask[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

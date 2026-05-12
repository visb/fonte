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
import { Staff } from '../staff/staff.entity';
import { SupportGroupMeeting } from './support-group-meeting.entity';

@Entity('support_groups')
export class SupportGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'church_name' })
  churchName: string;

  @Column()
  address: string;

  @Column({ name: 'coordinator_id', nullable: true, type: 'uuid' })
  coordinatorId: string | null;

  @ManyToOne(() => Staff, { eager: false, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'coordinator_id' })
  coordinator: Staff | null;

  @Column({ name: 'day_of_week', type: 'smallint' })
  dayOfWeek: number;

  @OneToMany(() => SupportGroupMeeting, (m) => m.supportGroup, { eager: false })
  meetings: SupportGroupMeeting[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

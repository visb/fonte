import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SupportGroup } from './support-group.entity';
import { SupportGroupCheckin } from './support-group-checkin.entity';

@Entity('support_group_meetings')
export class SupportGroupMeeting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'support_group_id' })
  supportGroupId: string;

  @ManyToOne(() => SupportGroup, (g) => g.meetings, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'support_group_id' })
  supportGroup: SupportGroup;

  @Column({ type: 'date' })
  date: string;

  @Column({ nullable: true, type: 'text' })
  notes: string | null;

  @Column({ name: 'checkin_token', type: 'uuid', unique: true })
  @Generated('uuid')
  checkinToken: string;

  @OneToMany(() => SupportGroupCheckin, (c) => c.meeting, { eager: false })
  checkins: SupportGroupCheckin[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

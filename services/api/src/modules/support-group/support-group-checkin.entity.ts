import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SupportGroupMeeting } from './support-group-meeting.entity';

@Entity('support_group_checkins')
export class SupportGroupCheckin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'meeting_id' })
  meetingId: string;

  @ManyToOne(() => SupportGroupMeeting, (m) => m.checkins, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meeting_id' })
  meeting: SupportGroupMeeting;

  @Column({ name: 'resident_id', type: 'uuid' })
  residentId: string;

  @Column({ name: 'checked_in_at', type: 'timestamptz', default: () => 'now()' })
  checkedInAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

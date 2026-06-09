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

@Entity('support_group_relative_checkins')
export class SupportGroupRelativeCheckin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'meeting_id' })
  meetingId: string;

  @ManyToOne(() => SupportGroupMeeting, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meeting_id' })
  meeting: SupportGroupMeeting;

  @Column({ name: 'relative_id', type: 'uuid' })
  relativeId: string;

  @Column({ name: 'checked_in_at', type: 'timestamptz', default: () => 'now()' })
  checkedInAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MessageStatus } from '@fonte/types';
import { Resident } from '../resident/resident.entity';
import { Relative } from '../relative/relative.entity';
import { Staff } from '../staff/staff.entity';
import { User } from '../user/user.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Resident, { eager: false, nullable: true })
  @JoinColumn({ name: 'resident_id' })
  resident: Resident | null;

  @Column({ name: 'resident_id', nullable: true, type: 'uuid' })
  residentId: string | null;

  @ManyToOne(() => Staff, { eager: false, nullable: true })
  @JoinColumn({ name: 'staff_id' })
  staff: Staff | null;

  @Column({ name: 'staff_id', nullable: true, type: 'uuid' })
  staffId: string | null;

  @ManyToOne(() => Relative, { eager: false })
  @JoinColumn({ name: 'relative_id' })
  relative: Relative;

  @Column({ name: 'relative_id' })
  relativeId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'sender_user_id' })
  senderUser: User;

  @Column({ name: 'sender_user_id' })
  senderUserId: string;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ name: 'attachment_url', type: 'text', nullable: true })
  attachmentUrl: string | null;

  @Column({ name: 'attachment_type', type: 'varchar', length: 10, nullable: true })
  attachmentType: string | null;

  @Column({ type: 'enum', enum: MessageStatus, default: MessageStatus.PENDING_APPROVAL })
  status: MessageStatus;

  @Column({ name: 'approved_by_user_id', nullable: true, type: 'uuid' })
  approvedByUserId: string | null;

  @Column({ name: 'approved_at', nullable: true, type: 'timestamp' })
  approvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

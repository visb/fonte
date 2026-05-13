import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MessageStatus } from '@fonte/types';
import { Resident } from '../resident/resident.entity';
import { Relative } from '../relative/relative.entity';
import { User } from '../user/user.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Resident, { eager: false })
  @JoinColumn({ name: 'resident_id' })
  resident: Resident;

  @Column({ name: 'resident_id' })
  residentId: string;

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

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'enum', enum: MessageStatus, default: MessageStatus.PENDING_APPROVAL })
  status: MessageStatus;

  @Column({ name: 'approved_by_user_id', nullable: true, type: 'uuid' })
  approvedByUserId: string | null;

  @Column({ name: 'approved_at', nullable: true, type: 'timestamp' })
  approvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

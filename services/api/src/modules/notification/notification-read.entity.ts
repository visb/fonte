import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Notification } from './notification.entity';

/**
 * Per-user read marker for a (possibly broadcast) notification. A broadcast
 * notification is read by many users, so a single `read_at` on the row does not
 * suffice — read state is computed by joining against this table.
 */
@Entity('notification_reads')
@Index('UQ_notification_reads_notification_user', ['notificationId', 'userId'], {
  unique: true,
})
export class NotificationRead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'notification_id', type: 'uuid' })
  notificationId: string;

  @ManyToOne(() => Notification, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notification_id' })
  notification: Notification;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @CreateDateColumn({ name: 'read_at' })
  readAt: Date;
}

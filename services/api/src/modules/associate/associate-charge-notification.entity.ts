import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Associate } from './associate.entity';

export type AssociateNotificationChannel = 'WHATSAPP';
export type AssociateNotificationType = 'ADHESION' | 'REACTIVATION';

@Entity('associate_charge_notifications')
export class AssociateChargeNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'associate_id', type: 'uuid' })
  associateId: string;

  @ManyToOne(() => Associate, { eager: false })
  @JoinColumn({ name: 'associate_id' })
  associate: Associate;

  @Column({ type: 'varchar' })
  channel: AssociateNotificationChannel;

  @Column({ type: 'varchar' })
  type: AssociateNotificationType;

  @Column({ name: 'sent_at', type: 'timestamp' })
  sentAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

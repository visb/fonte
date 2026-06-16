import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SubscriptionStatus } from '@fonte/types';
import { numericTransformer } from './numeric.transformer';
import { Associate } from './associate.entity';

@Entity('associate_subscriptions')
export class AssociateSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'associate_id', type: 'uuid' })
  associateId: string;

  @ManyToOne(() => Associate, (a) => a.subscriptions, { eager: false })
  @JoinColumn({ name: 'associate_id' })
  associate: Associate;

  @Column({ name: 'abacatepay_subscription_id', type: 'varchar', nullable: true })
  abacatepaySubscriptionId: string | null;

  @Column({ name: 'net_amount', type: 'numeric', precision: 10, scale: 2, transformer: numericTransformer })
  netAmount: number;

  @Column({ name: 'fee_amount', type: 'numeric', precision: 10, scale: 2, transformer: numericTransformer })
  feeAmount: number;

  @Column({ name: 'gross_amount', type: 'numeric', precision: 10, scale: 2, transformer: numericTransformer })
  grossAmount: number;

  @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.ACTIVE })
  status: SubscriptionStatus;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'canceled_at', type: 'timestamp', nullable: true })
  canceledAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ChargeStatus } from '@fonte/types';
import { numericTransformer } from './numeric.transformer';
import { Associate } from './associate.entity';
import { AssociateSubscription } from './associate-subscription.entity';

@Entity('associate_charges')
export class AssociateCharge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'associate_id', type: 'uuid' })
  associateId: string;

  @ManyToOne(() => Associate, (a) => a.charges, { eager: false })
  @JoinColumn({ name: 'associate_id' })
  associate: Associate;

  @Column({ name: 'subscription_id', type: 'uuid', nullable: true })
  subscriptionId: string | null;

  @ManyToOne(() => AssociateSubscription, { eager: false, nullable: true })
  @JoinColumn({ name: 'subscription_id' })
  subscription: AssociateSubscription | null;

  @Column({ name: 'gateway_charge_id', type: 'varchar', nullable: true })
  gatewayChargeId: string | null;

  @Column({ name: 'net_amount', type: 'numeric', precision: 10, scale: 2, transformer: numericTransformer })
  netAmount: number;

  @Column({ name: 'fee_amount', type: 'numeric', precision: 10, scale: 2, transformer: numericTransformer })
  feeAmount: number;

  @Column({ name: 'gross_amount', type: 'numeric', precision: 10, scale: 2, transformer: numericTransformer })
  grossAmount: number;

  @Column({ type: 'enum', enum: ChargeStatus, default: ChargeStatus.PENDING })
  status: ChargeStatus;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AssociateStatus } from '@fonte/types';
import { numericTransformer } from './numeric.transformer';
import { AssociateSubscription } from './associate-subscription.entity';
import { AssociateCharge } from './associate-charge.entity';

@Entity('associates')
export class Associate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  whatsapp: string;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({
    name: 'contribution_amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  contributionAmount: number;

  @Column({ name: 'due_day', type: 'smallint' })
  dueDay: number;

  @Column({ type: 'enum', enum: AssociateStatus, default: AssociateStatus.PENDING })
  status: AssociateStatus;

  @Column({ name: 'gateway_customer_id', type: 'varchar', nullable: true })
  gatewayCustomerId: string | null;

  @Column({ name: 'payment_token', type: 'uuid' })
  paymentToken: string;

  @OneToMany(() => AssociateSubscription, (s) => s.associate)
  subscriptions: AssociateSubscription[];

  @OneToMany(() => AssociateCharge, (c) => c.associate)
  charges: AssociateCharge[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

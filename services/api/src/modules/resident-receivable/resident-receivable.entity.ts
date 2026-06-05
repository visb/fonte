import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FamilyInvestment, PaymentMethod, ReceivableStatus } from '@fonte/types';
import { Resident } from '../resident/resident.entity';
import { Staff } from '../staff/staff.entity';

@Entity('resident_receivables')
export class ResidentReceivable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Resident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resident_id' })
  resident: Resident;

  @Column({ name: 'resident_id' })
  residentId: string;

  // First day of the competence month (YYYY-MM-01).
  @Column({ name: 'reference_month', type: 'date' })
  referenceMonth: Date;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: Date;

  // Frozen amount (reais) snapshot of the plan at generation time.
  @Column({ type: 'integer' })
  amount: number;

  @Column({ name: 'family_investment', type: 'enum', enum: FamilyInvestment, enumName: 'family_investment_enum' })
  familyInvestment: FamilyInvestment;

  // true → obligatory month (first 6 of treatment); false → voluntary (after 6).
  @Column({ type: 'boolean', default: true })
  mandatory: boolean;

  @Column({ type: 'enum', enum: ReceivableStatus, enumName: 'receivable_status_enum', default: ReceivableStatus.PENDING })
  status: ReceivableStatus;

  // Amount actually collected (reais); may diverge from the snapshot `amount`.
  @Column({ name: 'paid_amount', type: 'integer', nullable: true })
  paidAmount: number | null;

  // Modality actually used at payment time; may diverge from the snapshot `familyInvestment`.
  @Column({
    name: 'paid_family_investment',
    type: 'enum',
    enum: FamilyInvestment,
    enumName: 'family_investment_enum',
    nullable: true,
  })
  paidFamilyInvestment: FamilyInvestment | null;

  @Column({ name: 'paid_at', type: 'date', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod, enumName: 'payment_method_enum', nullable: true })
  paymentMethod: PaymentMethod | null;

  @Column({ name: 'attachment_url', type: 'varchar', nullable: true })
  attachmentUrl: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => Staff, { nullable: true, eager: false })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: Staff | null;

  @Column({ name: 'created_by_id', nullable: true, type: 'uuid' })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PayableCategory, PayableStatus } from '@fonte/types';

@Entity('payables')
export class Payable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  description: string;

  /** Valor em centavos (padrão do repo, ex. street_sales). */
  @Column({ type: 'integer' })
  amount: number;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ type: 'enum', enum: PayableCategory })
  category: PayableCategory;

  @Column({ type: 'varchar', nullable: true })
  supplier: string | null;

  @Column({ type: 'enum', enum: PayableStatus, default: PayableStatus.OPEN })
  status: PayableStatus;

  @Column({ name: 'paid_at', type: 'date', nullable: true })
  paidAt: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'attachment_url', type: 'varchar', nullable: true })
  attachmentUrl: string | null;

  @Column({ name: 'attachment_name', type: 'varchar', nullable: true })
  attachmentName: string | null;

  @Column({ name: 'payment_receipt_url', type: 'varchar', nullable: true })
  paymentReceiptUrl: string | null;

  @Column({ name: 'payment_receipt_name', type: 'varchar', nullable: true })
  paymentReceiptName: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

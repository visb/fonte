import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ReceiptSubjectType, ReceiptType } from '@fonte/types';

/**
 * Story 178 — REGISTRO da emissão de um recibo. Nunca o PDF (decisões 4 e 5).
 *
 * O arquivo é gerado sob demanda e some; o que precisa de memória é o NÚMERO,
 * porque a numeração é sequencial por tipo. `(receipt_type, subject_type,
 * subject_id)` é único: baixar o mesmo recibo dez vezes reusa o mesmo número em
 * vez de queimar dez.
 *
 * Sem `deleted_at` de propósito: recibo emitido não se apaga — buraco na
 * sequência é pior que registro obsoleto. Se um dia o recibo precisar ser prova
 * imutável de layout, é AQUI que uma coluna `file_url` entraria, sem migração de
 * conceito.
 */
@Entity('issued_receipts')
export class IssuedReceipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'receipt_type', type: 'varchar' })
  receiptType: ReceiptType;

  /** Sequencial POR TIPO (contribuição e pizza são livros distintos). */
  @Column({ type: 'int' })
  number: number;

  @Column({ name: 'subject_type', type: 'varchar' })
  subjectType: ReceiptSubjectType;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @Column({ name: 'issued_by_user_id', type: 'uuid', nullable: true })
  issuedByUserId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

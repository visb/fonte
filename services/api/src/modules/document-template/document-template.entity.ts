import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ReceiptType, TemplateAvailability, TemplateKind } from '@fonte/types';

@Entity('document_templates')
export class DocumentTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  name: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'is_required', type: 'boolean', default: false })
  isRequired: boolean;

  // LGPD/acolhimento — marca o template como documento a ser assinado no
  // acolhimento. Surge na aba de anexos do filho com flag específica.
  @Column({ name: 'sign_at_admission', type: 'boolean', default: false })
  signAtAdmission: boolean;

  // Story 160 — para quais filhos este documento pode ser gerado, pelo status do
  // acolhido. Varchar (não enum do Postgres) para o ternário poder virar lista um
  // dia sem ALTER TYPE; o valor é validado no service, contra TemplateAvailability.
  @Column({ name: 'available_for', type: 'varchar', default: TemplateAvailability.ALL })
  availableFor: TemplateAvailability;

  // Story 178 — que tipo de documento este template descreve. Default RESIDENT
  // (na coluna e na leitura): o template de recibo é invisível para a aba de
  // Anexos do filho sem que ela precise saber que recibos existem.
  @Column({ type: 'varchar', default: TemplateKind.RESIDENT })
  kind: TemplateKind;

  // Story 178 — só para kind = RECEIPT: qual recibo este template imprime.
  // Varchar (não enum do Postgres) pelo mesmo motivo do available_for: tipo novo
  // de recibo não exige ALTER TYPE. Único no banco (índice parcial) — um
  // template ativo por tipo, decisão 2.
  @Column({ name: 'receipt_type', type: 'varchar', nullable: true })
  receiptType: ReceiptType | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

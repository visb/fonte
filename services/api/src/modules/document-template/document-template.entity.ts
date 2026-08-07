import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TemplateAvailability } from '@fonte/types';

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

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

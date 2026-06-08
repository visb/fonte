import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

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

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

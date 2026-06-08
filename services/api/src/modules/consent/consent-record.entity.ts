import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Finalidades que dependem de consentimento (art. 11, I). Tutela da saúde NÃO
// passa por aqui — opera sob outra base legal. Ver docs/lgpd/DIAGNOSTICO_LGPD.md.
export type ConsentPurpose = 'IMAGE_PUBLICATION' | 'RELIGIOUS_DISCLOSURE';
export type ConsentSubjectType = 'RESIDENT' | 'RELATIVE';

// LGPD art. 8 — registro de consentimento. Tabela append-only: cada concessão
// ou revogação é uma nova linha, preservando o histórico/prova. O estado atual
// é a linha mais recente para (subject, purpose).
@Entity('consent_records')
@Index(['subjectType', 'subjectId', 'purpose'])
export class ConsentRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'subject_type', type: 'varchar' })
  subjectType: ConsentSubjectType;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @Column({ type: 'varchar' })
  purpose: ConsentPurpose;

  // true = consentimento concedido; false = revogado.
  @Column({ type: 'boolean' })
  granted: boolean;

  // Versão do termo/política aceito no momento da concessão.
  @Column({ name: 'term_version', type: 'varchar', nullable: true })
  termVersion: string | null;

  // Staff que registrou a operação (colheu a assinatura).
  @Column({ name: 'recorded_by_user_id', type: 'uuid', nullable: true })
  recordedByUserId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

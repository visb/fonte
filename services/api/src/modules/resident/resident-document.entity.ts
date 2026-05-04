import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Resident } from './resident.entity';
import { DocumentTemplate } from '../document-template/document-template.entity';

@Entity('resident_documents')
export class ResidentDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Resident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resident_id' })
  resident: Resident;

  @Column({ name: 'resident_id' })
  residentId: string;

  @ManyToOne(() => DocumentTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: DocumentTemplate;

  @Column({ name: 'template_id' })
  templateId: string;

  @Column({ name: 'signed_file_url', nullable: true, type: 'varchar' })
  signedFileUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

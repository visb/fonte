import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DocumentType } from '@fonte/types';

@Entity('document_templates')
export class DocumentTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: DocumentType, unique: true })
  type: DocumentType;

  @Column({ type: 'text' })
  content: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

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

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

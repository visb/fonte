import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DocumentType } from '@fonte/types';
import { Resident } from './resident.entity';

@Entity('resident_documents')
export class ResidentDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Resident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resident_id' })
  resident: Resident;

  @Column({ name: 'resident_id' })
  residentId: string;

  @Column({ type: 'enum', enum: DocumentType })
  type: DocumentType;

  @Column({ name: 'signed_file_url', nullable: true, type: 'varchar' })
  signedFileUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

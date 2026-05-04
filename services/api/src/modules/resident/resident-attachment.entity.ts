import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Resident } from './resident.entity';

@Entity('resident_attachments')
export class ResidentAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Resident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resident_id' })
  resident: Resident;

  @Column({ name: 'resident_id' })
  residentId: string;

  @Column()
  filename: string;

  @Column({ name: 'file_url' })
  fileUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

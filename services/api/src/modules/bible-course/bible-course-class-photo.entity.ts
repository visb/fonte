import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BibleCourseClass } from './bible-course-class.entity';
import { User } from '../user/user.entity';

/**
 * Foto da galeria de uma turma do curso bíblico (story 92). Espelha
 * `ActivityAttachment` simplificado: mídia 1-N ancorada na turma, só imagens,
 * soft delete e delete físico do objeto no bucket via `StorageService` na remoção.
 */
@Entity('bible_course_class_photos')
export class BibleCourseClassPhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  @ManyToOne(() => BibleCourseClass, { eager: false })
  @JoinColumn({ name: 'class_id' })
  class: BibleCourseClass;

  @Column({ name: 'file_url', type: 'text' })
  fileUrl: string;

  @Column({ name: 'file_name', type: 'text' })
  fileName: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 128 })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'int' })
  sizeBytes: number;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

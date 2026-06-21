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
import { ActivityAttachmentType } from '@fonte/types';
import { Activity } from './activity.entity';
import { ActivityComment } from './activity-comment.entity';
import { User } from '../user/user.entity';

/**
 * Anexo de uma atividade ou de um comentário (story 73). `activityId` é sempre
 * preenchido (âncora de escopo/visibilidade por casa). `commentId` nulo = anexo
 * da própria atividade; preenchido = anexo daquele comentário.
 */
@Entity('activity_attachments')
export class ActivityAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'activity_id', type: 'uuid' })
  activityId: string;

  @ManyToOne(() => Activity, { eager: false })
  @JoinColumn({ name: 'activity_id' })
  activity: Activity;

  @Index()
  @Column({ name: 'comment_id', type: 'uuid', nullable: true })
  commentId: string | null;

  @ManyToOne(() => ActivityComment, { eager: false, nullable: true })
  @JoinColumn({ name: 'comment_id' })
  comment: ActivityComment | null;

  @Column({ name: 'file_url', type: 'text' })
  fileUrl: string;

  @Column({ name: 'file_name', type: 'text' })
  fileName: string;

  @Column({ name: 'file_type', type: 'varchar', length: 16 })
  fileType: ActivityAttachmentType;

  @Column({ name: 'mime_type', type: 'varchar', length: 128 })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'int' })
  sizeBytes: number;

  /**
   * Duração em segundos para anexos de áudio (story 74). Medida no cliente e
   * enviada no upload; nullable (anexos não-áudio ou sem duração informada).
   */
  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number | null;

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

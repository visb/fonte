import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Resident } from '../resident/resident.entity';
import { User } from '../user/user.entity';

/**
 * Conclusão do curso bíblico FORA do sistema (story 127): fato histórico do
 * filho, anterior ao sistema. É do filho e não do acolhimento — atravessa
 * alta/evasão/readmissão e tira o filho das sugestões de matrícula para sempre.
 *
 * Índice único parcial `(resident_id) WHERE deleted_at IS NULL` garante no
 * máximo uma marcação ativa por filho; desfazer é soft delete e marcar de novo
 * cria linha nova (histórico preservado).
 */
@Entity('bible_course_external_completions')
export class BibleCourseExternalCompletion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'resident_id', type: 'uuid' })
  residentId: string;

  @ManyToOne(() => Resident, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resident_id' })
  resident: Resident;

  /** Usuário que marcou. Nulo quando o staff que marcou foi removido. */
  @Column({ name: 'marked_by', type: 'uuid', nullable: true })
  markedBy: string | null;

  @ManyToOne(() => User, { eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'marked_by' })
  markedByUser: User | null;

  @Column({ name: 'marked_at', type: 'timestamptz', default: () => 'now()' })
  markedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

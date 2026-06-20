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
import { Event } from './event.entity';

@Entity('event_registrations')
export class EventRegistration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event?: Event;

  @Column({ type: 'varchar' })
  name: string;

  /** Contato livre (telefone/WhatsApp ou e-mail). Validado no DTO. */
  @Column({ type: 'varchar' })
  contact: string;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  /**
   * Respostas dos campos custom (story 68). Mapa fieldId → valor. `file` guarda
   * a storage key (nunca URL). Default {}.
   */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  answers: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

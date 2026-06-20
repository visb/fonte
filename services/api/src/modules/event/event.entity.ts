import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RegistrationField } from '@fonte/types';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Index()
  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt: Date;

  @Column({ name: 'end_at', type: 'timestamptz', nullable: true })
  endAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  location: string | null;

  /** null = vagas ilimitadas. */
  @Column({ type: 'integer', nullable: true })
  capacity: number | null;

  /**
   * Inscrição habilitada (story 67). false = evento só-divulgação: não aparece
   * no portal público nem aceita inscrição. Default false na criação.
   */
  @Column({ name: 'registration_enabled', type: 'boolean', default: false })
  registrationEnabled: boolean;

  /**
   * Campos custom do formulário de inscrição (story 68). JSONB. Default []
   * (só base fixa name/contact/email?). `id` estável por campo.
   */
  @Column({ name: 'registration_fields', type: 'jsonb', default: () => "'[]'" })
  registrationFields: RegistrationField[];

  /** Referência do banner no storage (resultado de StorageService.upload). Nunca uma URL assinada. */
  @Column({ name: 'banner_key', type: 'varchar', nullable: true })
  bannerKey: string | null;

  @Column({ name: 'registration_opens_at', type: 'timestamptz', nullable: true })
  registrationOpensAt: Date | null;

  @Column({ name: 'registration_closes_at', type: 'timestamptz', nullable: true })
  registrationClosesAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

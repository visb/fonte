import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

/**
 * Preferência de UI por usuário (story 130). Chave-valor genérico: cada tela
 * grava a própria `key` (ex.: `residents.filters`) sem migration nova. Único
 * por `(user_id, key)` — a gravação é um upsert idempotente.
 */
@Entity('user_preferences')
@Unique('UQ_user_preferences_user_key', ['userId', 'key'])
export class UserPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'jsonb' })
  value: unknown;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

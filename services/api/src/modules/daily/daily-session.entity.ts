import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DailySessionStatus } from '@fonte/types';

/**
 * Story 225 — rascunho da daily de uma casa. No máximo uma `OPEN` por casa
 * (índice único parcial na migration). Sem soft delete: dado efêmero.
 */
@Entity('daily_sessions')
export class DailySession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'house_id', type: 'uuid' })
  houseId: string;

  @Column({ type: 'varchar', length: 10, default: DailySessionStatus.OPEN })
  status: DailySessionStatus;

  /** YYYY-MM-DD no fuso da operação. */
  @Column({ name: 'session_date', type: 'date' })
  sessionDate: string;

  @Column({ type: 'integer', default: 0 })
  version: number;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;

  @Column({ name: 'applied_at', type: 'timestamptz', nullable: true })
  appliedAt: Date | null;

  @Column({ name: 'applied_by_user_id', type: 'uuid', nullable: true })
  appliedByUserId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

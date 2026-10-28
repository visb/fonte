import { Column, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { DailyPersonType } from '@fonte/types';

/**
 * Story 225 — destino de uma pessoa no board da sessão. `ministryId` nulo =
 * "Sem ministério". Uma linha por pessoa por sessão.
 */
@Entity('daily_session_assignments')
@Unique('UQ_daily_session_assignments_person', ['sessionId', 'personType', 'personId'])
export class DailySessionAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId: string;

  @Column({ name: 'person_type', type: 'varchar', length: 10 })
  personType: DailyPersonType;

  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @Column({ name: 'ministry_id', type: 'uuid', nullable: true })
  ministryId: string | null;

  @Column({ name: 'updated_by_user_id', type: 'uuid', nullable: true })
  updatedByUserId: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

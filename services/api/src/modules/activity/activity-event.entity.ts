import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ActivityEventType } from '@fonte/types';
import { Activity } from './activity.entity';
import { User } from '../user/user.entity';

/**
 * Trilha de auditoria de uma atividade — story 66. Append-only (sem soft delete):
 * cada mutação relevante gera uma linha imutável.
 */
@Entity('activity_events')
export class ActivityEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'activity_id', type: 'uuid' })
  activityId: string;

  @ManyToOne(() => Activity, { eager: false })
  @JoinColumn({ name: 'activity_id' })
  activity: Activity;

  @Column({ type: 'enum', enum: ActivityEventType })
  type: ActivityEventType;

  @Column({ name: 'actor_user_id', type: 'uuid' })
  actorUserId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'actor_user_id' })
  actor: User;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Ministry } from './ministry.entity';

export type TaskRepetition = 'NONE' | 'DAILY';

@Entity('ministry_tasks')
export class MinistryTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ministry_id' })
  ministryId: string;

  @ManyToOne(() => Ministry, (m) => m.tasks, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ministry_id' })
  ministry: Ministry;

  @Column()
  title: string;

  @Column({ default: false })
  completed: boolean;

  @Column({ type: 'varchar', length: 10, default: 'NONE' })
  repetition: TaskRepetition;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

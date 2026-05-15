import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TimerResetFrequency } from '@fonte/types';

@Entity('app_settings')
export class AppSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'timer_reset_frequency', type: 'varchar', default: TimerResetFrequency.DAILY })
  timerResetFrequency: TimerResetFrequency;

  @Column({ name: 'daily_usage_minutes', type: 'int', default: 20 })
  dailyUsageMinutes: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

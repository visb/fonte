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
import { StaffDismissalReason } from '@fonte/types';
import { Staff } from './staff.entity';
import { House } from '../house/house.entity';

/**
 * Story 216 — período em que alguém serviu. Nasce aberto (`end_date` nulo) na
 * promoção do filho ou no cadastro direto do servo; no máximo um aberto por
 * staff (índice único parcial na migration). Fechado pelo desligamento (217).
 */
@Entity('staff_service_periods')
export class StaffServicePeriod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Staff, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staff_id' })
  staff?: Staff;

  @Column({ name: 'staff_id', type: 'uuid' })
  staffId: string;

  // Nula para servo sem casa (ex.: grupo de apoio).
  @ManyToOne(() => House, { eager: false, nullable: true })
  @JoinColumn({ name: 'house_id' })
  house?: House | null;

  @Column({ name: 'house_id', type: 'uuid', nullable: true })
  houseId: string | null;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  // Story 217 — motivo do desligamento que encerrou o período (nulo se o
  // período foi encerrado à mão pela edição da 216).
  @Column({
    name: 'end_reason',
    type: 'enum',
    enum: StaffDismissalReason,
    enumName: 'staff_service_periods_end_reason_enum',
    nullable: true,
  })
  endReason: StaffDismissalReason | null;

  @Column({ name: 'end_notes', type: 'text', nullable: true })
  endNotes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

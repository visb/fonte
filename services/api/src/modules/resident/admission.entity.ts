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
import { FamilyInvestment } from '@fonte/types';
import { Resident } from './resident.entity';
import { House } from '../house/house.entity';

@Entity('admissions')
export class Admission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Resident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resident_id' })
  resident: Resident;

  @Column({ name: 'resident_id' })
  residentId: string;

  @ManyToOne(() => House, { eager: false, nullable: true })
  @JoinColumn({ name: 'house_id' })
  house: House | null;

  // Nullable: acolhimento de filho ARCHIVED pode não ter casa conhecida.
  @Column({ name: 'house_id', nullable: true, type: 'uuid' })
  houseId: string | null;

  @Column({ name: 'ministry_id', nullable: true, type: 'uuid' })
  ministryId: string | null;

  @Column({ name: 'entry_date', type: 'date', nullable: true })
  entryDate: Date | null;

  @Column({ name: 'exit_date', type: 'date', nullable: true })
  exitDate: Date | null;

  @Column({ type: 'varchar' })
  status: string;

  @Column({ name: 'health_issues', nullable: true, type: 'varchar' })
  healthIssues: string | null;

  @Column({ name: 'continuous_medication', nullable: true, type: 'varchar' })
  continuousMedication: string | null;

  @Column({ nullable: true, type: 'integer' })
  weight: number | null;

  @Column({ nullable: true, type: 'integer' })
  height: number | null;

  @Column({ name: 'family_investment', type: 'enum', enum: FamilyInvestment, nullable: true })
  familyInvestment: FamilyInvestment | null;

  @Column({ name: 'family_investment_amount', type: 'integer', nullable: true })
  familyInvestmentAmount: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

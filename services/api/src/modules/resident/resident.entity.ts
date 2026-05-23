import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Gender, MaritalStatus, ResidentStatus } from '@fonte/types';
import { User } from '../user/user.entity';
import { House } from '../house/house.entity';
import { Ministry } from '../ministry/ministry.entity';

@Entity('residents')
export class Resident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: Date | null;

  @Column({ nullable: true, type: 'varchar' })
  cpf: string | null;

  @Column({ type: 'enum', enum: ResidentStatus, default: ResidentStatus.PRE_ADMISSION })
  status: ResidentStatus;

  @OneToOne(() => User, { eager: false, nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', nullable: true, type: 'uuid' })
  userId: string | null;

  @ManyToOne(() => House, { eager: false })
  @JoinColumn({ name: 'house_id' })
  house: House;

  @Column({ name: 'house_id' })
  houseId: string;

  @ManyToOne(() => Ministry, { eager: false, nullable: true })
  @JoinColumn({ name: 'ministry_id' })
  ministry: Ministry | null;

  @Column({ name: 'ministry_id', nullable: true, type: 'uuid' })
  ministryId: string | null;

  @Column({ name: 'entry_date', type: 'date', nullable: true })
  entryDate: Date | null;

  @Column({ name: 'exit_date', type: 'date', nullable: true })
  exitDate: Date | null;

  // --- Admission fields ---

  get age(): number | null {
    if (!this.birthDate) return null;
    const today = new Date();
    const birth = new Date(this.birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender | null;

  @Column({ nullable: true, type: 'varchar' })
  rg: string | null;

  @Column({ nullable: true, type: 'varchar' })
  address: string | null;

  @Column({ name: 'contact_phone', nullable: true, type: 'varchar' })
  contactPhone: string | null;

  @Column({ nullable: true, type: 'varchar' })
  email: string | null;

  @Column({ name: 'marital_status', type: 'enum', enum: MaritalStatus, nullable: true })
  maritalStatus: MaritalStatus | null;

  @Column({ type: 'integer', default: 0 })
  children: number;

  @Column({ nullable: true, type: 'varchar' })
  occupation: string | null;

  @Column({ name: 'guardian_id', nullable: true, type: 'uuid' })
  guardianId: string | null;

  @Column({ nullable: true, type: 'varchar' })
  education: string | null;

  @Column({ name: 'health_issues', nullable: true, type: 'varchar' })
  healthIssues: string | null;

  @Column({ name: 'continuous_medication', nullable: true, type: 'varchar' })
  continuousMedication: string | null;

  @Column({ nullable: true, type: 'varchar' })
  religion: string | null;

  @Column({ nullable: true, type: 'varchar' })
  addiction: string | null;

  @Column({ nullable: true, type: 'integer' })
  weight: number | null;

  @Column({ nullable: true, type: 'integer' })
  height: number | null;

  @Column({ name: 'family_investment', nullable: true, type: 'varchar' })
  familyInvestment: string | null;

  @Column({ name: 'photo_url', nullable: true, type: 'varchar' })
  photoUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

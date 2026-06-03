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
import { Gender, MaritalStatus, ServantRank } from '@fonte/types';
import { User } from '../user/user.entity';
import { House } from '../house/house.entity';
import { SupportGroup } from '../support-group/support-group.entity';

@Entity('staff')
export class Staff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true, type: 'varchar' })
  phone: string | null;

  // --- Ficha pessoal (espelha os dados pessoais do filho/resident) ---

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: Date | null;

  @Column({ nullable: true, type: 'varchar' })
  cpf: string | null;

  @Column({ nullable: true, type: 'varchar' })
  rg: string | null;

  @Column({ nullable: true, type: 'varchar' })
  nationality: string | null;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender | null;

  @Column({ nullable: true, type: 'varchar' })
  city: string | null;

  @Column({ nullable: true, type: 'varchar' })
  state: string | null;

  @Column({ nullable: true, type: 'varchar' })
  address: string | null;

  @Column({ name: 'marital_status', type: 'enum', enum: MaritalStatus, nullable: true })
  maritalStatus: MaritalStatus | null;

  @Column({ type: 'integer', default: 0 })
  children: number;

  @Column({ nullable: true, type: 'varchar' })
  occupation: string | null;

  @Column({ nullable: true, type: 'varchar' })
  education: string | null;

  @Column({ nullable: true, type: 'varchar' })
  religion: string | null;

  @Column({ nullable: true, type: 'varchar' })
  addiction: string | null;

  @Column({ name: 'health_issues', nullable: true, type: 'varchar' })
  healthIssues: string | null;

  @Column({ name: 'continuous_medication', nullable: true, type: 'varchar' })
  continuousMedication: string | null;

  @Column({ nullable: true, type: 'integer' })
  weight: number | null;

  @Column({ nullable: true, type: 'integer' })
  height: number | null;

  @OneToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => House, { eager: false, nullable: true })
  @JoinColumn({ name: 'house_id' })
  house: House | null;

  @Column({ name: 'house_id', nullable: true, type: 'uuid' })
  houseId: string | null;

  @Column({ name: 'photo_url', nullable: true, type: 'varchar' })
  photoUrl: string | null;

  // Nível espiritual do servo (SERVANT). Null para ADMIN/COORDINATOR.
  @Column({ name: 'rank', type: 'enum', enum: ServantRank, nullable: true })
  rank: ServantRank | null;

  // Vínculo histórico: este servo foi um filho (acolhido) antes de ser promovido.
  // FK para residents(id) garantida na migration; relação não mapeada de propósito
  // para não acoplar a entidade Staff à entidade Resident.
  @Column({ name: 'former_resident_id', nullable: true, type: 'uuid' })
  formerResidentId: string | null;

  // Data em que o filho foi promovido a servo. Null para servos criados direto.
  @Column({ name: 'promoted_at', type: 'date', nullable: true })
  promotedAt: string | null;

  @ManyToOne(() => SupportGroup, { eager: false, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'support_group_id' })
  supportGroup: SupportGroup | null;

  @Column({ name: 'support_group_id', nullable: true, type: 'uuid' })
  supportGroupId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

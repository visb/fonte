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
import { ServantRank } from '@fonte/types';
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

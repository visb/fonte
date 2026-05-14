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

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
import { WishlistStatus } from '@fonte/types';
import { Resident } from '../resident/resident.entity';
import { User } from '../user/user.entity';

@Entity('wishlist_items')
export class WishlistItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Resident, { eager: false })
  @JoinColumn({ name: 'resident_id' })
  resident: Resident;

  @Column({ name: 'resident_id' })
  residentId: string;

  @Column({ type: 'varchar' })
  description: string;

  @Column({ type: 'integer', default: 1 })
  quantity: number;

  @Column({ type: 'enum', enum: WishlistStatus, default: WishlistStatus.PENDING_APPROVAL })
  status: WishlistStatus;

  @Column({ name: 'is_removal_requested', default: false })
  isRemovalRequested: boolean;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser: User;

  @Column({ name: 'created_by_user_id' })
  createdByUserId: string;

  @Column({ name: 'approved_by_user_id', nullable: true, type: 'uuid' })
  approvedByUserId: string | null;

  @Column({ name: 'approved_at', nullable: true, type: 'timestamp' })
  approvedAt: Date | null;

  @Column({ name: 'rejection_reason', nullable: true, type: 'text' })
  rejectionReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

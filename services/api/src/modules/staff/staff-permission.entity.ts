import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { StaffPermissionType } from '@fonte/types';
import { Staff } from './staff.entity';

@Entity('staff_permissions')
@Unique(['staffId', 'permissionType'])
export class StaffPermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'staff_id' })
  staffId: string;

  @ManyToOne(() => Staff, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staff_id' })
  staff: Staff;

  @Column({ name: 'permission_type', type: 'varchar' })
  permissionType: StaffPermissionType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

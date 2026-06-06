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
import { HouseCapacityRequestStatus } from '@fonte/types';
import { Staff } from '../staff/staff.entity';
import { House } from './house.entity';

/**
 * Pedido de alteração de capacidade de leitos feito pelo COORDINATOR no ops.
 * Só aplica na casa após o ADMIN aprovar. Mantém histórico (todos os status).
 */
@Entity('house_capacity_requests')
export class HouseCapacityRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'house_id', type: 'uuid' })
  houseId: string;

  @ManyToOne(() => House, { eager: false })
  @JoinColumn({ name: 'house_id' })
  house: House;

  @Column({ name: 'requested_general_capacity', type: 'integer' })
  requestedGeneralCapacity: number;

  @Column({ name: 'requested_staff_capacity', type: 'integer' })
  requestedStaffCapacity: number;

  // Snapshot da capacidade vigente no momento do pedido (para exibir no histórico).
  @Column({ name: 'previous_general_capacity', type: 'integer', nullable: true })
  previousGeneralCapacity: number | null;

  @Column({ name: 'previous_staff_capacity', type: 'integer', nullable: true })
  previousStaffCapacity: number | null;

  @Column({
    type: 'enum',
    enum: HouseCapacityRequestStatus,
    enumName: 'house_capacity_request_status_enum',
    default: HouseCapacityRequestStatus.PENDING,
  })
  status: HouseCapacityRequestStatus;

  // Staff (coordenador) que pediu a alteração.
  @Column({ name: 'requested_by_id', type: 'uuid' })
  requestedById: string;

  @ManyToOne(() => Staff, { eager: false })
  @JoinColumn({ name: 'requested_by_id' })
  requestedBy: Staff;

  // User (admin) que aprovou/rejeitou. Null enquanto PENDING.
  @Column({ name: 'reviewed_by_id', type: 'uuid', nullable: true })
  reviewedById: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

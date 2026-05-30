import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StreetSaleType } from '@fonte/types';
import { House } from '../house/house.entity';
import { Staff } from '../staff/staff.entity';

@Entity('street_sales')
export class StreetSale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'house_id' })
  houseId: string;

  @ManyToOne(() => House, { eager: false })
  @JoinColumn({ name: 'house_id' })
  house: House;

  @Column({ name: 'registered_by', nullable: true })
  registeredById: string | null;

  @ManyToOne(() => Staff, { eager: false, nullable: true })
  @JoinColumn({ name: 'registered_by' })
  registeredBy: Staff | null;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'enum', enum: StreetSaleType })
  type: StreetSaleType;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ name: 'amount_pix', type: 'integer', default: 0 })
  amountPix: number;

  @Column({ name: 'amount_cash', type: 'integer', default: 0 })
  amountCash: number;

  @Column({ name: 'amount_card', type: 'integer', default: 0 })
  amountCard: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

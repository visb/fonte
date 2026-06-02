import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Staff } from '../staff/staff.entity';
import { HousePhoto } from './house-photo.entity';

@Entity('houses')
export class House {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'general_capacity', nullable: true, type: 'integer' })
  generalCapacity: number | null;

  @Column({ name: 'staff_capacity', nullable: true, type: 'integer' })
  staffCapacity: number | null;

  @Column({ nullable: true, type: 'varchar' })
  address: string | null;

  @Column({ nullable: true, type: 'varchar' })
  city: string | null;

  @Column({ nullable: true, type: 'varchar', length: 2 })
  state: string | null;

  @Column({ name: 'coordinator_id', nullable: true, type: 'uuid' })
  coordinatorId: string | null;

  @ManyToOne(() => Staff, { eager: false, nullable: true })
  @JoinColumn({ name: 'coordinator_id' })
  coordinator: Staff | null;

  @Column({ nullable: true, type: 'varchar' })
  phone: string | null;

  @Column({ name: 'is_mother_house', default: false })
  isMotherHouse: boolean;

  @OneToMany(() => HousePhoto, (photo) => photo.house)
  photos: HousePhoto[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

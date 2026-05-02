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
import { ResidentStatus } from '@fonte/types';
import { User } from '../user/user.entity';
import { House } from '../house/house.entity';

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

  @Column({ name: 'entry_date', type: 'date', nullable: true })
  entryDate: Date | null;

  @Column({ name: 'exit_date', type: 'date', nullable: true })
  exitDate: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

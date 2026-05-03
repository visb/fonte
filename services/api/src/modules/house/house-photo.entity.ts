import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { House } from './house.entity';

@Entity('house_photos')
export class HousePhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => House, (house) => house.photos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'house_id' })
  house: House;

  @Column({ name: 'house_id' })
  houseId: string;

  @Column()
  filename: string;

  @Column()
  path: string;

  @Column()
  url: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

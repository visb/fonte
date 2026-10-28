import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IncidentType } from '@fonte/types';
import { House } from '../house/house.entity';
import { Staff } from '../staff/staff.entity';
import { Resident } from '../resident/resident.entity';

@Entity('incidents')
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: string;

  // Story 229: positiva/negativa — substituiu a severidade (coluna removida).
  @Column({ type: 'enum', enum: IncidentType, enumName: 'incident_type' })
  type: IncidentType;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'house_id' })
  houseId: string;

  @ManyToOne(() => House, { eager: false })
  @JoinColumn({ name: 'house_id' })
  house: House;

  @Column({ name: 'responsible_id' })
  responsibleId: string;

  @ManyToOne(() => Staff, { eager: false })
  @JoinColumn({ name: 'responsible_id' })
  responsible: Staff;

  // Story 227: N filhos por ocorrência (junção `incident_residents`). A resposta
  // expõe só `{ id, name }` de cada um — o service seleciona apenas esses campos.
  @ManyToMany(() => Resident)
  @JoinTable({
    name: 'incident_residents',
    joinColumn: { name: 'incident_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'resident_id', referencedColumnName: 'id' },
  })
  residents: Resident[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

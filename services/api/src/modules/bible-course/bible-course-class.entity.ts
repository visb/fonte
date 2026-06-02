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
import { BibleCourseClassStatus } from '@fonte/types';
import { House } from '../house/house.entity';
import { BibleCourseEnrollment } from './bible-course-enrollment.entity';

@Entity('bible_course_classes')
export class BibleCourseClass {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'house_id', type: 'uuid' })
  houseId: string;

  @ManyToOne(() => House, { eager: false })
  @JoinColumn({ name: 'house_id' })
  house: House;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ type: 'varchar', default: BibleCourseClassStatus.PLANNED })
  status: BibleCourseClassStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => BibleCourseEnrollment, (e) => e.class, { eager: false })
  enrollments: BibleCourseEnrollment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

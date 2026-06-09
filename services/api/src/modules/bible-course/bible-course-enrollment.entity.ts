import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BibleCourseEnrollmentStatus } from '@fonte/types';
import { BibleCourseClass } from './bible-course-class.entity';
import { Resident } from '../resident/resident.entity';

@Entity('bible_course_enrollments')
export class BibleCourseEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  @ManyToOne(() => BibleCourseClass, (c) => c.enrollments, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  class: BibleCourseClass;

  @Column({ name: 'resident_id', type: 'uuid' })
  residentId: string;

  @ManyToOne(() => Resident, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resident_id' })
  resident: Resident;

  @Column({ type: 'varchar', default: BibleCourseEnrollmentStatus.ENROLLED })
  status: BibleCourseEnrollmentStatus;

  @Column({ name: 'enrolled_at', type: 'timestamptz', default: () => 'now()' })
  enrolledAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

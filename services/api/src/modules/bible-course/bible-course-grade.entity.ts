import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { BibleCourseEnrollment } from './bible-course-enrollment.entity';
import { BibleCourseModule } from './bible-course-module.entity';

@Entity('bible_course_grades')
@Unique('UQ_bible_course_grades', ['enrollmentId', 'moduleId'])
export class BibleCourseGrade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'enrollment_id', type: 'uuid' })
  enrollmentId: string;

  @ManyToOne(() => BibleCourseEnrollment, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'enrollment_id' })
  enrollment: BibleCourseEnrollment;

  @Column({ name: 'module_id', type: 'uuid' })
  moduleId: string;

  @ManyToOne(() => BibleCourseModule, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'module_id' })
  module: BibleCourseModule;

  @Column({ name: 'exam_grade', type: 'numeric', precision: 4, scale: 2, nullable: true })
  examGrade: number | null;

  @Column({ name: 'work_grade', type: 'numeric', precision: 4, scale: 2, nullable: true })
  workGrade: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

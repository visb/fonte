import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BibleCourseEnrollmentStatus } from '@fonte/types';
import { BibleCourseClass } from './bible-course-class.entity';
import { BibleCourseEnrollment } from './bible-course-enrollment.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';

@Injectable()
export class BibleCourseService {
  constructor(
    @InjectRepository(BibleCourseClass)
    private classRepo: Repository<BibleCourseClass>,
    @InjectRepository(BibleCourseEnrollment)
    private enrollmentRepo: Repository<BibleCourseEnrollment>,
  ) {}

  // ─── Classes ───────────────────────────────────────────────────────────────

  async findAllClasses(status?: string): Promise<Array<{
    id: string;
    name: string;
    houseId: string;
    houseName: string;
    startDate: string;
    endDate: string;
    status: string;
    enrollmentCount: number;
    createdAt: Date;
  }>> {
    return this.classRepo.manager.query(
      `SELECT c.id,
              c.name,
              c.house_id   AS "houseId",
              h.name       AS "houseName",
              c.start_date::text AS "startDate",
              c.end_date::text   AS "endDate",
              c.status,
              COUNT(e.id)::int   AS "enrollmentCount",
              c.created_at AS "createdAt"
       FROM bible_course_classes c
       LEFT JOIN houses h ON h.id = c.house_id
       LEFT JOIN bible_course_enrollments e ON e.class_id = c.id
       WHERE c.deleted_at IS NULL
         AND ($1::varchar IS NULL OR c.status = $1)
       GROUP BY c.id, h.name
       ORDER BY c.start_date DESC`,
      [status ?? null],
    );
  }

  async createClass(dto: CreateClassDto): Promise<BibleCourseClass> {
    return this.classRepo.save(
      this.classRepo.create({
        name: dto.name,
        houseId: dto.houseId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        notes: dto.notes ?? null,
      }),
    );
  }

  async findOneClass(id: string): Promise<{
    id: string;
    name: string;
    houseId: string;
    houseName: string;
    startDate: string;
    endDate: string;
    status: string;
    notes: string | null;
    createdAt: Date;
    enrollments: Array<{
      id: string;
      residentId: string;
      residentName: string;
      residentHouseId: string | null;
      residentHouseName: string | null;
      status: string;
      enrolledAt: Date;
      completedAt: Date | null;
      notes: string | null;
    }>;
  }> {
    const [row] = await this.classRepo.manager.query(
      `SELECT c.id,
              c.name,
              c.house_id   AS "houseId",
              h.name       AS "houseName",
              c.start_date::text AS "startDate",
              c.end_date::text   AS "endDate",
              c.status,
              c.notes,
              c.created_at AS "createdAt"
       FROM bible_course_classes c
       LEFT JOIN houses h ON h.id = c.house_id
       WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [id],
    );
    if (!row) throw new NotFoundException(`BibleCourseClass ${id} not found`);

    const enrollments = await this.classRepo.manager.query(
      `SELECT e.id,
              e.resident_id AS "residentId",
              r.name        AS "residentName",
              r.house_id    AS "residentHouseId",
              rh.name       AS "residentHouseName",
              e.status,
              e.enrolled_at  AS "enrolledAt",
              e.completed_at AS "completedAt",
              e.notes
       FROM bible_course_enrollments e
       JOIN residents r ON r.id = e.resident_id AND r.deleted_at IS NULL
       LEFT JOIN houses rh ON rh.id = r.house_id
       WHERE e.class_id = $1
       ORDER BY r.name ASC`,
      [id],
    );

    return { ...row, enrollments };
  }

  async updateClass(id: string, dto: UpdateClassDto): Promise<BibleCourseClass> {
    const klass = await this.classRepo.findOne({ where: { id } });
    if (!klass) throw new NotFoundException(`BibleCourseClass ${id} not found`);

    if (dto.name !== undefined) klass.name = dto.name;
    if (dto.houseId !== undefined) klass.houseId = dto.houseId;
    if (dto.startDate !== undefined) klass.startDate = dto.startDate;
    if (dto.endDate !== undefined) klass.endDate = dto.endDate;
    if (dto.status !== undefined) klass.status = dto.status;
    if (dto.notes !== undefined) klass.notes = dto.notes ?? null;

    return this.classRepo.save(klass);
  }

  async removeClass(id: string): Promise<void> {
    const klass = await this.classRepo.findOne({ where: { id } });
    if (!klass) throw new NotFoundException(`BibleCourseClass ${id} not found`);
    await this.classRepo.softDelete(id);
  }

  // ─── Enrollments ─────────────────────────────────────────────────────────────

  async enroll(classId: string, dto: CreateEnrollmentDto): Promise<BibleCourseEnrollment> {
    const klass = await this.classRepo.findOne({ where: { id: classId } });
    if (!klass) throw new NotFoundException(`BibleCourseClass ${classId} not found`);

    const [resident] = await this.classRepo.manager.query<[{ id: string } | undefined]>(
      `SELECT id FROM residents WHERE id = $1 AND deleted_at IS NULL`,
      [dto.residentId],
    );
    if (!resident) throw new NotFoundException(`Resident ${dto.residentId} not found`);

    const existing = await this.enrollmentRepo.findOne({
      where: { classId, residentId: dto.residentId },
    });
    if (existing) throw new ConflictException('Filho já matriculado nesta turma');

    return this.enrollmentRepo.save(
      this.enrollmentRepo.create({
        classId,
        residentId: dto.residentId,
        notes: dto.notes ?? null,
      }),
    );
  }

  async updateEnrollment(id: string, dto: UpdateEnrollmentDto): Promise<BibleCourseEnrollment> {
    const enrollment = await this.enrollmentRepo.findOne({ where: { id } });
    if (!enrollment) throw new NotFoundException(`Enrollment ${id} not found`);

    if (dto.status !== undefined) {
      enrollment.status = dto.status;
      enrollment.completedAt =
        dto.status === BibleCourseEnrollmentStatus.COMPLETED ? new Date() : null;
    }
    if (dto.notes !== undefined) enrollment.notes = dto.notes ?? null;

    return this.enrollmentRepo.save(enrollment);
  }

  async removeEnrollment(id: string): Promise<void> {
    const enrollment = await this.enrollmentRepo.findOne({ where: { id } });
    if (!enrollment) throw new NotFoundException(`Enrollment ${id} not found`);
    await this.enrollmentRepo.delete(id);
  }
}

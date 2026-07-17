import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BibleCourseEnrollmentStatus, ResidentStatus } from '@fonte/types';
import {
  BibleClassGrades,
  BibleCourseExternalCompletion as BibleCourseExternalCompletionDto,
  EligibleResident,
} from '@fonte/types';
import { BibleCourseClass } from './bible-course-class.entity';
import { BibleCourseEnrollment } from './bible-course-enrollment.entity';
import { BibleCourseModule } from './bible-course-module.entity';
import { BibleCourseGrade } from './bible-course-grade.entity';
import { BibleCourseExternalCompletion } from './bible-course-external-completion.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { UpsertGradeDto } from './dto/upsert-grade.dto';

/**
 * Tempo mínimo de casa (em meses) para um filho ser sugerido para matrícula no
 * curso bíblico. Configurável via query param `months`; a constante é o default.
 */
export const ELIGIBLE_TREATMENT_MONTHS = 3;

@Injectable()
export class BibleCourseService {
  constructor(
    @InjectRepository(BibleCourseClass)
    private classRepo: Repository<BibleCourseClass>,
    @InjectRepository(BibleCourseEnrollment)
    private enrollmentRepo: Repository<BibleCourseEnrollment>,
    @InjectRepository(BibleCourseModule)
    private moduleRepo: Repository<BibleCourseModule>,
    @InjectRepository(BibleCourseGrade)
    private gradeRepo: Repository<BibleCourseGrade>,
    @InjectRepository(BibleCourseExternalCompletion)
    private externalCompletionRepo: Repository<BibleCourseExternalCompletion>,
  ) {}

  // ─── Modules (catalogo compartilhado) ────────────────────────────────────────

  findAllModules(): Promise<BibleCourseModule[]> {
    return this.moduleRepo.find({ order: { sequence: 'ASC', name: 'ASC' } });
  }

  createModule(dto: CreateModuleDto): Promise<BibleCourseModule> {
    return this.moduleRepo.save(
      this.moduleRepo.create({
        name: dto.name,
        sequence: dto.sequence ?? 0,
        notes: dto.notes ?? null,
      }),
    );
  }

  async updateModule(id: string, dto: UpdateModuleDto): Promise<BibleCourseModule> {
    const module = await this.moduleRepo.findOne({ where: { id } });
    if (!module) throw new NotFoundException(`BibleCourseModule ${id} not found`);

    if (dto.name !== undefined) module.name = dto.name;
    if (dto.sequence !== undefined) module.sequence = dto.sequence;
    if (dto.notes !== undefined) module.notes = dto.notes ?? null;

    return this.moduleRepo.save(module);
  }

  async removeModule(id: string): Promise<void> {
    const module = await this.moduleRepo.findOne({ where: { id } });
    if (!module) throw new NotFoundException(`BibleCourseModule ${id} not found`);
    await this.moduleRepo.softDelete(id);
  }

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

  /**
   * Meses completos entre duas datas (mesmo cálculo de "tempo de casa"): conta a
   * diferença de meses do calendário e desconta 1 se o dia do mês ainda não
   * chegou no mês corrente.
   */
  static monthsBetween(from: Date, to: Date): number {
    let months =
      (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    if (to.getDate() < from.getDate()) months -= 1;
    return months;
  }

  /**
   * Filhos elegíveis para sugestão de matrícula no curso, de TODAS as casas:
   * ativos (`status ∈ {ACTIVE, DISCIPLINE}` e `exitDate` nulo), com pelo menos
   * `months` meses de casa (`entryDate <= hoje − months`), sem matrícula ativa
   * (qualquer enrollment não-desistente em turma não deletada) e sem marcação
   * de curso feito fora do sistema (story 127). Ordena por `entryDate` (mais
   * antigo primeiro).
   */
  async findEligibleResidents(
    months: number = ELIGIBLE_TREATMENT_MONTHS,
  ): Promise<EligibleResident[]> {
    const rows: Array<{
      id: string;
      name: string;
      photoThumbUrl: string | null;
      entryDate: string;
      houseId: string;
      houseName: string | null;
    }> = await this.classRepo.manager.query(
      `SELECT r.id,
              r.name,
              r.photo_thumb_url   AS "photoThumbUrl",
              r.entry_date::text  AS "entryDate",
              r.house_id          AS "houseId",
              h.name              AS "houseName"
       FROM residents r
       LEFT JOIN houses h ON h.id = r.house_id
       WHERE r.deleted_at IS NULL
         AND r.status IN ('${ResidentStatus.ACTIVE}', '${ResidentStatus.DISCIPLINE}')
         AND r.exit_date IS NULL
         AND r.entry_date IS NOT NULL
         AND r.entry_date <= (CURRENT_DATE - ($1::int * INTERVAL '1 month'))
         AND NOT EXISTS (
           SELECT 1
           FROM bible_course_enrollments e
           JOIN bible_course_classes c ON c.id = e.class_id AND c.deleted_at IS NULL
           WHERE e.resident_id = r.id
             AND e.deleted_at IS NULL
             AND e.status <> '${BibleCourseEnrollmentStatus.DROPPED}'
         )
         AND NOT EXISTS (
           SELECT 1
           FROM bible_course_external_completions x
           WHERE x.resident_id = r.id
             AND x.deleted_at IS NULL
         )
       ORDER BY r.entry_date ASC`,
      [months],
    );

    const today = new Date();
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      photoThumbUrl: row.photoThumbUrl,
      entryDate: row.entryDate,
      monthsInTreatment: BibleCourseService.monthsBetween(
        new Date(row.entryDate + 'T00:00:00'),
        today,
      ),
      houseId: row.houseId,
      houseName: row.houseName ?? '',
    }));
  }

  /**
   * Matrícula em lote atômica: matricula todos os `residentIds` na turma numa
   * única transação. Deduplica ids repetidos, ignora quem já está matriculado
   * nessa turma e faz rollback se algum residente não existir.
   */
  async enrollBulk(
    classId: string,
    residentIds: string[],
  ): Promise<{ enrolled: number }> {
    const klass = await this.classRepo.findOne({ where: { id: classId } });
    if (!klass) throw new NotFoundException(`BibleCourseClass ${classId} not found`);

    const uniqueIds = [...new Set(residentIds)];

    return this.enrollmentRepo.manager.transaction(async (manager) => {
      let enrolled = 0;
      for (const residentId of uniqueIds) {
        const [resident] = await manager.query<Array<{ id: string }>>(
          `SELECT id FROM residents WHERE id = $1 AND deleted_at IS NULL`,
          [residentId],
        );
        if (!resident) throw new NotFoundException(`Resident ${residentId} not found`);

        const existing = await manager.findOne(BibleCourseEnrollment, {
          where: { classId, residentId },
        });
        if (existing) continue;

        await manager.save(
          manager.create(BibleCourseEnrollment, { classId, residentId }),
        );
        enrolled += 1;
      }
      return { enrolled };
    });
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

  // ─── Grades (notas por módulo) ───────────────────────────────────────────────

  /** Média de um conjunto de notas ignorando nulos. Retorna null se nada para média. */
  static average(values: Array<number | null | undefined>): number | null {
    const present = values.filter((v): v is number => v !== null && v !== undefined);
    if (present.length === 0) return null;
    const sum = present.reduce((acc, v) => acc + v, 0);
    return Math.round((sum / present.length) * 100) / 100;
  }

  /**
   * Matriz de notas da turma: para cada matrícula, a lista de módulos com
   * {examGrade, workGrade, moduleAverage} e a média geral do aluno (média das
   * médias de módulo, ignorando módulos sem nota).
   */
  async getClassGrades(classId: string): Promise<BibleClassGrades> {
    const klass = await this.classRepo.findOne({ where: { id: classId } });
    if (!klass) throw new NotFoundException(`BibleCourseClass ${classId} not found`);

    const modules = await this.moduleRepo.find({
      order: { sequence: 'ASC', name: 'ASC' },
    });

    const enrollments: Array<{ id: string; residentName: string }> =
      await this.enrollmentRepo.manager.query(
        `SELECT e.id, r.name AS "residentName"
         FROM bible_course_enrollments e
         JOIN residents r ON r.id = e.resident_id AND r.deleted_at IS NULL
         WHERE e.class_id = $1
         ORDER BY r.name ASC`,
        [classId],
      );

    const grades = await this.gradeRepo
      .createQueryBuilder('g')
      .innerJoin(
        'bible_course_enrollments',
        'e',
        'e.id = g.enrollment_id AND e.class_id = :classId',
        { classId },
      )
      .getMany();

    const byKey = new Map<string, BibleCourseGrade>();
    for (const g of grades) {
      byKey.set(`${g.enrollmentId}:${g.moduleId}`, g);
    }

    const toNumber = (v: number | string | null): number | null =>
      v === null || v === undefined ? null : Number(v);

    const rows = enrollments.map((e) => {
      const moduleGrades = modules.map((m) => {
        const g = byKey.get(`${e.id}:${m.id}`);
        const examGrade = toNumber(g?.examGrade ?? null);
        const workGrade = toNumber(g?.workGrade ?? null);
        return {
          moduleId: m.id,
          examGrade,
          workGrade,
          moduleAverage: BibleCourseService.average([examGrade, workGrade]),
        };
      });
      const average = BibleCourseService.average(
        moduleGrades.map((mg) => mg.moduleAverage),
      );
      return {
        enrollmentId: e.id,
        residentName: e.residentName,
        modules: moduleGrades,
        average,
      };
    });

    return {
      classId,
      modules: modules.map((m) => ({ id: m.id, name: m.name, sequence: m.sequence })),
      rows,
    };
  }

  // ─── Conclusão fora do sistema (story 127) ───────────────────────────────────

  /** 404 se o filho não existe (ou está soft-deletado). */
  private async assertResidentExists(residentId: string): Promise<void> {
    const [resident] = await this.externalCompletionRepo.manager.query<
      Array<{ id: string }>
    >(`SELECT id FROM residents WHERE id = $1 AND deleted_at IS NULL`, [residentId]);
    if (!resident) throw new NotFoundException(`Resident ${residentId} not found`);
  }

  /**
   * Marca que o filho **concluiu o curso fora do sistema**. Fato histórico do
   * filho: atravessa alta/evasão/readmissão e o exclui das sugestões para
   * sempre. **Idempotente** (decisão 6): clique repetido ou corrida não cria
   * segunda marcação nem estoura erro — devolve a marcação já existente.
   */
  async markExternalCompletion(
    residentId: string,
    userId: string | null,
  ): Promise<BibleCourseExternalCompletionDto> {
    await this.assertResidentExists(residentId);

    const existing = await this.externalCompletionRepo.findOne({ where: { residentId } });
    if (!existing) {
      try {
        await this.externalCompletionRepo.save(
          this.externalCompletionRepo.create({ residentId, markedBy: userId ?? null }),
        );
      } catch (error) {
        // Corrida entre dois cliques: o índice único parcial barra a segunda
        // inserção. A marcação existe — devolvê-la é o resultado esperado.
        if ((error as { code?: string })?.code !== '23505') throw error;
      }
    }

    return (await this.findExternalCompletion(residentId)) as BibleCourseExternalCompletionDto;
  }

  /** Desfaz a marcação (soft delete — a linha fica no histórico). 404 se não há marcação ativa. */
  async unmarkExternalCompletion(residentId: string): Promise<void> {
    const existing = await this.externalCompletionRepo.findOne({ where: { residentId } });
    if (!existing) {
      throw new NotFoundException(`External completion for resident ${residentId} not found`);
    }
    await this.externalCompletionRepo.softDelete(existing.id);
  }

  /**
   * Marcação ativa do filho, com quem/quando, ou `null` se não há (inclusive
   * quando a última marcação foi desfeita). `markedBy` nulo = o usuário que
   * marcou foi removido (FK ON DELETE SET NULL).
   */
  async findExternalCompletion(
    residentId: string,
  ): Promise<BibleCourseExternalCompletionDto | null> {
    const [row] = await this.externalCompletionRepo.manager.query<
      Array<{ markedAt: Date; markedById: string | null; markedByName: string | null }>
    >(
      `SELECT x.marked_at                AS "markedAt",
              x.marked_by                AS "markedById",
              COALESCE(s.name, u.email)  AS "markedByName"
       FROM bible_course_external_completions x
       LEFT JOIN users u ON u.id = x.marked_by
       LEFT JOIN staff s ON s.user_id = u.id AND s.deleted_at IS NULL
       WHERE x.resident_id = $1 AND x.deleted_at IS NULL
       LIMIT 1`,
      [residentId],
    );
    if (!row) return null;

    return {
      residentId,
      markedAt: new Date(row.markedAt).toISOString(),
      markedBy: row.markedById
        ? { id: row.markedById, name: row.markedByName ?? '' }
        : null,
    };
  }

  /** Cria ou edita a nota de uma matrícula num módulo (idempotente). */
  async upsertGrade(
    enrollmentId: string,
    moduleId: string,
    dto: UpsertGradeDto,
  ): Promise<BibleCourseGrade> {
    const enrollment = await this.enrollmentRepo.findOne({ where: { id: enrollmentId } });
    if (!enrollment) throw new NotFoundException(`Enrollment ${enrollmentId} not found`);

    const module = await this.moduleRepo.findOne({ where: { id: moduleId } });
    if (!module) throw new NotFoundException(`BibleCourseModule ${moduleId} not found`);

    let grade = await this.gradeRepo.findOne({ where: { enrollmentId, moduleId } });
    if (!grade) {
      grade = this.gradeRepo.create({ enrollmentId, moduleId });
    }

    if (dto.examGrade !== undefined) grade.examGrade = dto.examGrade ?? null;
    if (dto.workGrade !== undefined) grade.workGrade = dto.workGrade ?? null;

    return this.gradeRepo.save(grade);
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  AuditAction,
  AuditTargetType,
  isMinistryEligibleResident,
  MINISTRY_RESIDENT_NOT_ELIGIBLE_MESSAGE,
  REMOVABLE_RESIDENT_STATUSES,
  ServantRank,
} from '@fonte/types';
import { Ministry } from './ministry.entity';
import { MinistryStaff } from './ministry-staff.entity';
import { MinistryTask } from './ministry-task.entity';
import { CreateMinistryDto } from './dto/create-ministry.dto';
import { UpdateMinistryDto } from './dto/update-ministry.dto';
import { CreateMinistryTaskDto } from './dto/create-ministry-task.dto';
import { UpdateMinistryTaskDto } from './dto/update-ministry-task.dto';
import { Resident } from '../resident/resident.entity';
import { AuditService, loadById } from '../audit/audit.service';
import type { AuditSnapshot } from '../audit/audit-diff';
import {
  MINISTRY_AUDIT_FIELDS,
  MINISTRY_STAFF_AUDIT_FIELDS,
  RESIDENT_MINISTRY_AUDIT_FIELDS,
} from '../audit/audit-fields';

@Injectable()
export class MinistryService {
  constructor(
    @InjectRepository(Ministry)
    private repo: Repository<Ministry>,
    @InjectRepository(MinistryStaff)
    private staffRepo: Repository<MinistryStaff>,
    @InjectRepository(MinistryTask)
    private taskRepo: Repository<MinistryTask>,
    // Story 199 — último de propósito: os anteriores são contrato dos specs.
    private audit: AuditService,
  ) {}

  // ─── House-scoped list ───────────────────────────────────────────────────────

  // Story 205: filho volta a ser membro e líder. A contagem vem separada
  // (servos · filhos) e só conta filho em acolhimento na casa do ministério
  // (decisão 8) — dado legado incoerente não infla o número.
  async findByHouse(houseId: string): Promise<
    Array<{
      id: string;
      name: string;
      leaderId: string | null;
      leaderType: string | null;
      leaderName: string | null;
      leaderRank: ServantRank | null;
      filhoCount: number;
      servoCount: number;
    }>
  > {
    return this.repo.manager.query(
      `SELECT m.id,
              m.name,
              m.leader_id   AS "leaderId",
              m.leader_type AS "leaderType",
              CASE
                WHEN m.leader_type = 'STAFF'    THEN s.name
                WHEN m.leader_type = 'RESIDENT' THEN r.name
                ELSE NULL
              END AS "leaderName",
              CASE WHEN m.leader_type = 'STAFF' THEN s.rank ELSE NULL END AS "leaderRank",
              COUNT(DISTINCT res.id)::int AS "filhoCount",
              COUNT(DISTINCT ms.staff_id)::int AS "servoCount"
       FROM ministries m
       LEFT JOIN staff     s   ON s.id  = m.leader_id AND m.leader_type = 'STAFF'    AND s.deleted_at IS NULL
       LEFT JOIN residents r   ON r.id  = m.leader_id AND m.leader_type = 'RESIDENT' AND r.deleted_at IS NULL
       LEFT JOIN residents res ON res.ministry_id = m.id
                              AND res.house_id = m.house_id
                              AND res.status::text = ANY($2::text[])
                              AND res.deleted_at IS NULL
       LEFT JOIN ministry_staff ms ON ms.ministry_id = m.id
       WHERE m.house_id = $1 AND m.deleted_at IS NULL
       GROUP BY m.id, m.name, m.leader_id, m.leader_type, s.name, s.rank, r.name
       ORDER BY m.name`,
      [houseId, [...REMOVABLE_RESIDENT_STATUSES]],
    );
  }

  async create(houseId: string, dto: CreateMinistryDto): Promise<Ministry> {
    return this.trackMinistry(undefined, AuditAction.MINISTRY_CREATE, (m) => {
      const repo = m.getRepository(Ministry);
      return repo.save(repo.create({ ...dto, houseId }));
    });
  }

  /** Story 199 — escrita no ministério com antes/depois na mesma transação. */
  private trackMinistry<R>(
    id: string | undefined,
    action: string,
    write: (manager: EntityManager) => Promise<R>,
  ): Promise<R> {
    return this.audit.track<R>({
      action,
      targetType: AuditTargetType.MINISTRY,
      targetId: id,
      fields: MINISTRY_AUDIT_FIELDS,
      load: loadById(Ministry),
      lockTable: id ? 'ministries' : undefined,
      resolveId: (result) => (result as unknown as Ministry).id,
      write,
    });
  }

  /** Story 199 — vínculo filho↔ministério visto pela ficha do filho (`ministryId`). */
  private trackResidentLink(
    action: string,
    ministryId: string,
    residentId: string,
    write: (manager: EntityManager) => Promise<unknown>,
  ): Promise<unknown> {
    return this.audit.track({
      action,
      targetType: AuditTargetType.RESIDENT,
      targetId: residentId,
      fields: RESIDENT_MINISTRY_AUDIT_FIELDS,
      load: async (m, id) =>
        ((await m.getRepository(Resident).findOne({ where: { id } })) as AuditSnapshot | null) ?? null,
      lockTable: 'residents',
      scope: ({ after, before }) => ({
        houseId: ((after ?? before)?.houseId as string | null | undefined) ?? null,
        parentType: AuditTargetType.MINISTRY,
        parentId: ministryId,
      }),
      write,
    });
  }

  /** Story 199 — vínculo servo↔ministério (linha de `ministry_staff`). */
  private trackStaffLink(
    action: string,
    ministryId: string,
    staffId: string,
    write: (manager: EntityManager) => Promise<unknown>,
  ): Promise<unknown> {
    return this.audit.track({
      action,
      targetType: AuditTargetType.MINISTRY,
      targetId: ministryId,
      fields: MINISTRY_STAFF_AUDIT_FIELDS,
      load: async (m, id) =>
        ((await m
          .getRepository(MinistryStaff)
          .findOne({ where: { ministryId: id, staffId } })) as AuditSnapshot | null) ?? null,
      scope: () => ({ parentType: AuditTargetType.STAFF, parentId: staffId }),
      write,
    });
  }

  // ─── Single ministry ─────────────────────────────────────────────────────────

  async findOne(id: string): Promise<{
    id: string;
    name: string;
    houseId: string;
    leaderId: string | null;
    leaderType: string | null;
    leaderName: string | null;
    leaderRank: ServantRank | null;
    members: Array<{ id: string; name: string; role: 'FILHO' | 'SERVO' }>;
  }> {
    const [rows] = await this.repo.manager.query<[{ id: string; name: string; house_id: string; leader_id: string | null; leader_type: string | null; leader_name: string | null; leader_rank: ServantRank | null }]>(
      `SELECT m.id, m.name, m.house_id, m.leader_id, m.leader_type,
              CASE
                WHEN m.leader_type = 'STAFF'    THEN s.name
                WHEN m.leader_type = 'RESIDENT' THEN r.name
                ELSE NULL
              END AS leader_name,
              CASE WHEN m.leader_type = 'STAFF' THEN s.rank ELSE NULL END AS leader_rank
       FROM ministries m
       LEFT JOIN staff     s ON s.id = m.leader_id AND m.leader_type = 'STAFF'    AND s.deleted_at IS NULL
       LEFT JOIN residents r ON r.id = m.leader_id AND m.leader_type = 'RESIDENT' AND r.deleted_at IS NULL
       WHERE m.id = $1 AND m.deleted_at IS NULL`,
      [id],
    );
    if (!rows) throw new NotFoundException(`Ministry ${id} not found`);

    const [filhos, servos] = await Promise.all([
      // Decisão 8: só filho em acolhimento na casa do ministério aparece.
      this.repo.manager.query<Array<{ id: string; name: string }>>(
        `SELECT id, name FROM residents
          WHERE ministry_id = $1 AND house_id = $2
            AND status::text = ANY($3::text[])
            AND deleted_at IS NULL
          ORDER BY name`,
        [id, rows.house_id, [...REMOVABLE_RESIDENT_STATUSES]],
      ),
      this.repo.manager.query<Array<{ id: string; name: string }>>(
        `SELECT st.id, st.name FROM ministry_staff ms JOIN staff st ON st.id = ms.staff_id AND st.deleted_at IS NULL WHERE ms.ministry_id = $1 ORDER BY st.name`,
        [id],
      ),
    ]);

    return {
      id: rows.id,
      name: rows.name,
      houseId: rows.house_id,
      leaderId: rows.leader_id,
      leaderType: rows.leader_type,
      leaderName: rows.leader_name,
      // Story 207: nível do líder servo; líder RESIDENT ou sem líder → null.
      leaderRank: rows.leader_rank ?? null,
      members: [
        ...filhos.map((f) => ({ id: f.id, name: f.name, role: 'FILHO' as const })),
        ...servos.map((s) => ({ id: s.id, name: s.name, role: 'SERVO' as const })),
      ],
    };
  }

  async update(id: string, dto: UpdateMinistryDto): Promise<Ministry> {
    const ministry = await this.repo.findOne({ where: { id } });
    if (!ministry) throw new NotFoundException(`Ministry ${id} not found`);

    // Story 205 (decisão 6): filho só lidera se estiver em acolhimento na casa
    // do ministério. Valida o par resultante, antes de persistir qualquer coisa.
    const nextType = dto.leaderType !== undefined ? dto.leaderType : ministry.leaderType;
    const nextLeaderId = dto.leaderId !== undefined ? dto.leaderId : ministry.leaderId;
    const leaderTouched = dto.leaderType !== undefined || dto.leaderId !== undefined;
    if (leaderTouched && nextType === 'RESIDENT' && nextLeaderId) {
      await this.assertEligibleResident(ministry.houseId, nextLeaderId);
    }

    if (dto.name !== undefined) ministry.name = dto.name;
    if (dto.leaderId !== undefined) ministry.leaderId = dto.leaderId ?? null;
    if (dto.leaderType !== undefined) ministry.leaderType = dto.leaderType ?? null;

    return this.trackMinistry(id, AuditAction.MINISTRY_UPDATE, (m) =>
      m.getRepository(Ministry).save(ministry),
    );
  }

  async remove(id: string): Promise<void> {
    const ministry = await this.repo.findOne({ where: { id } });
    if (!ministry) throw new NotFoundException(`Ministry ${id} not found`);
    await this.trackMinistry(id, AuditAction.MINISTRY_DELETE, async (m) => {
      // Ministério tem soft delete: o `ON DELETE SET NULL` da FK não dispara, então
      // os filhos saem do ministério aqui (story 205). Story 199: um evento por
      // filho desvinculado, na mesma transação (correlação = a requisição).
      const linked = await m.query<Array<{ id: string; house_id: string | null }>>(
        `SELECT id, house_id FROM residents WHERE ministry_id = $1 FOR UPDATE`,
        [id],
      );
      await m.query(`UPDATE residents SET ministry_id = NULL WHERE ministry_id = $1`, [id]);
      for (const resident of linked ?? []) {
        await this.audit.recordChange(m, {
          action: AuditAction.MINISTRY_RESIDENT_REMOVE,
          targetType: AuditTargetType.RESIDENT,
          targetId: resident.id,
          houseId: resident.house_id,
          parentType: AuditTargetType.MINISTRY,
          parentId: id,
          changes: [{ field: 'ministryId', before: id, after: null, redacted: false }],
        });
      }
      await m.getRepository(Ministry).softDelete(id);
    });
  }

  // ─── Members: filhos ─────────────────────────────────────────────────────────

  /**
   * Story 205 (decisão 6): o vínculo só existe para filho em acolhimento
   * (`REMOVABLE_RESIDENT_STATUSES`) na mesma casa do ministério. A regra é do
   * backend — o build antigo do `ops` mostrou que filtro só de tela não segura.
   */
  private async assertEligibleResident(ministryHouseId: string, residentId: string): Promise<void> {
    const [resident] = await this.repo.manager.query<
      [{ id: string; house_id: string | null; status: string } | undefined]
    >(`SELECT id, house_id, status FROM residents WHERE id = $1 AND deleted_at IS NULL`, [residentId]);
    if (!resident) throw new NotFoundException(`Resident ${residentId} not found`);
    if (!isMinistryEligibleResident({ status: resident.status, houseId: resident.house_id }, ministryHouseId)) {
      throw new BadRequestException(MINISTRY_RESIDENT_NOT_ELIGIBLE_MESSAGE);
    }
  }

  async addResident(ministryId: string, residentId: string): Promise<void> {
    const ministry = await this.repo.findOne({ where: { id: ministryId } });
    if (!ministry) throw new NotFoundException(`Ministry ${ministryId} not found`);

    await this.assertEligibleResident(ministry.houseId, residentId);

    await this.trackResidentLink(AuditAction.MINISTRY_RESIDENT_ADD, ministryId, residentId, (m) =>
      m.query(`UPDATE residents SET ministry_id = $1 WHERE id = $2`, [ministryId, residentId]),
    );
  }

  async removeResident(ministryId: string, residentId: string): Promise<void> {
    // Filho fora do ministério: o UPDATE não muda nada e o track não gera evento.
    await this.trackResidentLink(AuditAction.MINISTRY_RESIDENT_REMOVE, ministryId, residentId, (m) =>
      m.query(`UPDATE residents SET ministry_id = NULL WHERE id = $1 AND ministry_id = $2`, [
        residentId,
        ministryId,
      ]),
    );
  }

  // ─── Members: servos ─────────────────────────────────────────────────────────

  async addStaff(ministryId: string, staffId: string): Promise<void> {
    const ministry = await this.repo.findOne({ where: { id: ministryId } });
    if (!ministry) throw new NotFoundException(`Ministry ${ministryId} not found`);

    const existing = await this.staffRepo.findOne({ where: { ministryId, staffId } });
    if (existing) throw new ConflictException('Staff already in this ministry');

    await this.trackStaffLink(AuditAction.MINISTRY_STAFF_ADD, ministryId, staffId, (m) => {
      const repo = m.getRepository(MinistryStaff);
      return repo.save(repo.create({ ministryId, staffId }));
    });
  }

  async removeStaff(ministryId: string, staffId: string): Promise<void> {
    await this.trackStaffLink(AuditAction.MINISTRY_STAFF_REMOVE, ministryId, staffId, (m) =>
      m.getRepository(MinistryStaff).delete({ ministryId, staffId }),
    );
  }

  // ─── Tasks ───────────────────────────────────────────────────────────────────

  async findTasks(ministryId: string): Promise<MinistryTask[]> {
    return this.taskRepo.find({
      where: { ministryId },
      order: { createdAt: 'ASC' },
    });
  }

  async createTask(ministryId: string, dto: CreateMinistryTaskDto): Promise<MinistryTask> {
    const ministry = await this.repo.findOne({ where: { id: ministryId } });
    if (!ministry) throw new NotFoundException(`Ministry ${ministryId} not found`);

    return this.taskRepo.save(
      this.taskRepo.create({
        ministryId,
        title: dto.title,
        repetition: dto.repetition ?? 'NONE',
      }),
    );
  }

  async updateTask(ministryId: string, taskId: string, dto: UpdateMinistryTaskDto): Promise<MinistryTask> {
    const task = await this.taskRepo.findOne({ where: { id: taskId, ministryId } });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.repetition !== undefined) task.repetition = dto.repetition;

    if (dto.completed !== undefined) {
      task.completed = dto.completed;
      if (dto.completed) {
        task.completedAt = new Date();
      } else {
        task.completedAt = null;
      }
    }

    return this.taskRepo.save(task);
  }

  async removeTask(ministryId: string, taskId: string): Promise<void> {
    const task = await this.taskRepo.findOne({ where: { id: taskId, ministryId } });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);
    await this.taskRepo.softDelete(taskId);
  }
}

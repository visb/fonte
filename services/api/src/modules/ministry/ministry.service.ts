import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ministry } from './ministry.entity';
import { MinistryStaff } from './ministry-staff.entity';
import { MinistryTask } from './ministry-task.entity';
import { CreateMinistryDto } from './dto/create-ministry.dto';
import { UpdateMinistryDto } from './dto/update-ministry.dto';
import { CreateMinistryTaskDto } from './dto/create-ministry-task.dto';
import { UpdateMinistryTaskDto } from './dto/update-ministry-task.dto';

@Injectable()
export class MinistryService {
  constructor(
    @InjectRepository(Ministry)
    private repo: Repository<Ministry>,
    @InjectRepository(MinistryStaff)
    private staffRepo: Repository<MinistryStaff>,
    @InjectRepository(MinistryTask)
    private taskRepo: Repository<MinistryTask>,
  ) {}

  // ─── House-scoped list ───────────────────────────────────────────────────────

  async findByHouse(houseId: string): Promise<
    Array<{
      id: string;
      name: string;
      leaderId: string | null;
      leaderType: string | null;
      leaderName: string | null;
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
              COUNT(DISTINCT res.id)::int AS "filhoCount",
              COUNT(DISTINCT ms.staff_id)::int AS "servoCount"
       FROM ministries m
       LEFT JOIN staff     s   ON s.id  = m.leader_id AND m.leader_type = 'STAFF'    AND s.deleted_at IS NULL
       LEFT JOIN residents r   ON r.id  = m.leader_id AND m.leader_type = 'RESIDENT' AND r.deleted_at IS NULL
       LEFT JOIN residents res ON res.ministry_id = m.id AND res.deleted_at IS NULL
       LEFT JOIN ministry_staff ms ON ms.ministry_id = m.id
       WHERE m.house_id = $1 AND m.deleted_at IS NULL
       GROUP BY m.id, m.name, m.leader_id, m.leader_type, s.name, r.name
       ORDER BY m.name`,
      [houseId],
    );
  }

  async create(houseId: string, dto: CreateMinistryDto): Promise<Ministry> {
    return this.repo.save(this.repo.create({ ...dto, houseId }));
  }

  // ─── Single ministry ─────────────────────────────────────────────────────────

  async findOne(id: string): Promise<{
    id: string;
    name: string;
    houseId: string;
    leaderId: string | null;
    leaderType: string | null;
    leaderName: string | null;
    members: Array<{ id: string; name: string; role: 'FILHO' | 'SERVO' }>;
  }> {
    const [rows] = await this.repo.manager.query<[{ id: string; name: string; house_id: string; leader_id: string | null; leader_type: string | null; leader_name: string | null }]>(
      `SELECT m.id, m.name, m.house_id, m.leader_id, m.leader_type,
              CASE
                WHEN m.leader_type = 'STAFF'    THEN s.name
                WHEN m.leader_type = 'RESIDENT' THEN r.name
                ELSE NULL
              END AS leader_name
       FROM ministries m
       LEFT JOIN staff     s ON s.id = m.leader_id AND m.leader_type = 'STAFF'    AND s.deleted_at IS NULL
       LEFT JOIN residents r ON r.id = m.leader_id AND m.leader_type = 'RESIDENT' AND r.deleted_at IS NULL
       WHERE m.id = $1 AND m.deleted_at IS NULL`,
      [id],
    );
    if (!rows) throw new NotFoundException(`Ministry ${id} not found`);

    const [filhos, servos] = await Promise.all([
      this.repo.manager.query<Array<{ id: string; name: string }>>(
        `SELECT id, name FROM residents WHERE ministry_id = $1 AND deleted_at IS NULL ORDER BY name`,
        [id],
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
      members: [
        ...filhos.map((f) => ({ id: f.id, name: f.name, role: 'FILHO' as const })),
        ...servos.map((s) => ({ id: s.id, name: s.name, role: 'SERVO' as const })),
      ],
    };
  }

  async update(id: string, dto: UpdateMinistryDto): Promise<Ministry> {
    const ministry = await this.repo.findOne({ where: { id } });
    if (!ministry) throw new NotFoundException(`Ministry ${id} not found`);

    if (dto.name !== undefined) ministry.name = dto.name;
    if (dto.leaderId !== undefined) ministry.leaderId = dto.leaderId ?? null;
    if (dto.leaderType !== undefined) ministry.leaderType = dto.leaderType ?? null;

    return this.repo.save(ministry);
  }

  async remove(id: string): Promise<void> {
    const ministry = await this.repo.findOne({ where: { id } });
    if (!ministry) throw new NotFoundException(`Ministry ${id} not found`);
    await this.repo.softDelete(id);
  }

  // ─── Members ─────────────────────────────────────────────────────────────────

  async addResident(ministryId: string, residentId: string): Promise<void> {
    const ministry = await this.repo.findOne({ where: { id: ministryId } });
    if (!ministry) throw new NotFoundException(`Ministry ${ministryId} not found`);

    const [resident] = await this.repo.manager.query<[{ id: string; house_id: string } | undefined]>(
      `SELECT id, house_id FROM residents WHERE id = $1 AND deleted_at IS NULL`,
      [residentId],
    );
    if (!resident) throw new NotFoundException(`Resident ${residentId} not found`);
    if (resident.house_id !== ministry.houseId) {
      throw new ConflictException('Resident does not belong to the same house as the ministry');
    }

    await this.repo.manager.query(
      `UPDATE residents SET ministry_id = $1 WHERE id = $2`,
      [ministryId, residentId],
    );
  }

  async removeResident(ministryId: string, residentId: string): Promise<void> {
    await this.repo.manager.query(
      `UPDATE residents SET ministry_id = NULL WHERE id = $1 AND ministry_id = $2`,
      [residentId, ministryId],
    );
  }

  async addStaff(ministryId: string, staffId: string): Promise<void> {
    const ministry = await this.repo.findOne({ where: { id: ministryId } });
    if (!ministry) throw new NotFoundException(`Ministry ${ministryId} not found`);

    const existing = await this.staffRepo.findOne({ where: { ministryId, staffId } });
    if (existing) throw new ConflictException('Staff already in this ministry');

    await this.staffRepo.save(this.staffRepo.create({ ministryId, staffId }));
  }

  async removeStaff(ministryId: string, staffId: string): Promise<void> {
    await this.staffRepo.delete({ ministryId, staffId });
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

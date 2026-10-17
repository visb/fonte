import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  AuditAction,
  AuditTargetType,
  FollowUpAccessLevel,
  FollowUpType,
  Role,
  ResidentStatus,
} from '@fonte/types';
import { AuditService, loadById } from '../audit/audit.service';
import { AuditSnapshot, diffSnapshots } from '../audit/audit-diff';
import { FOLLOW_UP_AUDIT_FIELDS, RESIDENT_AUDIT_FIELDS } from '../audit/audit-fields';
import { ResidentFollowUp } from './resident-follow-up.entity';
import { Staff } from '../staff/staff.entity';
import { Resident } from '../resident/resident.entity';
import { CreateFollowUpDto } from './dto/create-follow-up.dto';
import { BulkCreateContributionsDto } from './dto/bulk-create-contributions.dto';
import { StorageService } from '../storage/storage.service';
import { toDbTimestamp } from '../../common/lib/db-timestamp';

const STATUS_BY_TYPE: Partial<Record<FollowUpType, ResidentStatus>> = {
  [FollowUpType.DISCHARGE]: ResidentStatus.DISCHARGED,
  [FollowUpType.EVASION]: ResidentStatus.EVADED,
};

export interface ResidentFollowUpView {
  id: string;
  residentId: string;
  date: string;
  type: FollowUpType;
  description: string | null;
  accessLevel: FollowUpAccessLevel;
  attachmentUrl: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ResidentFollowUpService {
  constructor(
    @InjectRepository(ResidentFollowUp)
    private repo: Repository<ResidentFollowUp>,
    @InjectRepository(Staff)
    private staffRepo: Repository<Staff>,
    @InjectRepository(Resident)
    private residentRepo: Repository<Resident>,
    private storageService: StorageService,
    // Story 199 — último de propósito: os anteriores são contrato dos specs.
    private audit: AuditService,
  ) {}

  async findByResident(residentId: string, role: string): Promise<ResidentFollowUpView[]> {
    const qb = this.repo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.createdBy', 'staff')
      .where('f.resident_id = :residentId', { residentId })
      .andWhere('f.deleted_at IS NULL');

    if (role === Role.SERVANT) {
      qb.andWhere('f.access_level = :level', { level: FollowUpAccessLevel.ALL });
    }

    qb.orderBy('f.date', 'DESC').addOrderBy('f.created_at', 'DESC');

    const items = await qb.getMany();
    return items.map((item) => this.toView(item));
  }

  /**
   * Lote (story 177): follow-ups de N filhos numa consulta só, para o snapshot
   * offline da casa. `since` recorta o delta por `updated_at`. O filtro de
   * `access_level` para SERVANT é o MESMO de `findByResident` — o pacote offline
   * não pode ser um atalho para o servo ver evento de administração.
   */
  async findByResidents(
    residentIds: string[],
    role: string,
    since?: Date,
  ): Promise<ResidentFollowUpView[]> {
    if (residentIds.length === 0) return [];

    const qb = this.repo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.createdBy', 'staff')
      .where('f.resident_id IN (:...residentIds)', { residentIds })
      .andWhere('f.deleted_at IS NULL');

    if (role === Role.SERVANT) {
      qb.andWhere('f.access_level = :level', { level: FollowUpAccessLevel.ALL });
    }

    if (since) {
      qb.andWhere('f.updated_at > :since', { since: toDbTimestamp(since) });
    }

    qb.orderBy('f.date', 'DESC').addOrderBy('f.created_at', 'DESC');

    const items = await qb.getMany();
    return items.map((item) => this.toView(item));
  }

  /** Ids apagados desde `since` (story 177) — o app remove do store local. */
  async findDeletedIdsSince(residentIds: string[], since: Date): Promise<string[]> {
    if (residentIds.length === 0) return [];
    const rows = await this.repo
      .createQueryBuilder('f')
      .select('f.id', 'id')
      .withDeleted()
      .where('f.resident_id IN (:...residentIds)', { residentIds })
      .andWhere('f.deleted_at > :since', { since: toDbTimestamp(since) })
      .getRawMany<{ id: string }>();
    return rows.map((row) => row.id);
  }

  async create(residentId: string, dto: CreateFollowUpDto, staffUserId: string): Promise<ResidentFollowUpView> {
    const staff = await this.staffRepo.findOne({ where: { userId: staffUserId } });

    // SERVANT can only create ALL-level events
    const accessLevel =
      dto.accessLevel === FollowUpAccessLevel.ADMINISTRATION && staff
        ? dto.accessLevel
        : dto.accessLevel;

    const entry = this.repo.create({
      residentId,
      date: dto.date as unknown as Date,
      type: dto.type,
      description: dto.description ?? null,
      accessLevel,
      createdById: staff?.id ?? null,
    });
    // Story 199: lançamento de contribuição pelo acompanhamento entra na trilha.
    const saved =
      dto.type === FollowUpType.MONTHLY_CONTRIBUTION
        ? await this.audit.track<ResidentFollowUp>({
            action: AuditAction.RESIDENT_CONTRIBUTION_CREATE,
            targetType: AuditTargetType.RESIDENT_FOLLOW_UP,
            fields: FOLLOW_UP_AUDIT_FIELDS,
            load: loadById(ResidentFollowUp),
            resolveId: (f) => f.id,
            scope: () => ({ parentType: AuditTargetType.RESIDENT, parentId: residentId }),
            write: (m) => m.getRepository(ResidentFollowUp).save(entry),
          })
        : await this.repo.save(entry);

    // Status-changing events: update resident directly (bypass ResidentService to avoid loop)
    const newStatus = STATUS_BY_TYPE[dto.type];
    if (newStatus) {
      await this.audit.track({
        action: AuditAction.RESIDENT_STATUS_UPDATE,
        targetType: AuditTargetType.RESIDENT,
        targetId: residentId,
        fields: RESIDENT_AUDIT_FIELDS,
        load: loadById(Resident),
        lockTable: 'residents',
        write: (m) =>
          m.getRepository(Resident).update(residentId, {
            status: newStatus,
            exitDate: dto.date as unknown as Date,
          }),
      });
    }

    const loaded = await this.repo.findOne({ where: { id: saved.id }, relations: ['createdBy'] });
    return this.toView(loaded!);
  }

  async getLastContributionDates(residentIds: string[]): Promise<Map<string, string>> {
    if (residentIds.length === 0) return new Map();
    const rows = await this.repo
      .createQueryBuilder('f')
      .select('f.resident_id', 'residentId')
      .addSelect('MAX(f.date)', 'lastDate')
      .where('f.resident_id IN (:...residentIds)', { residentIds })
      .andWhere('f.type = :type', { type: FollowUpType.MONTHLY_CONTRIBUTION })
      .andWhere('f.deleted_at IS NULL')
      .groupBy('f.resident_id')
      .getRawMany<{ residentId: string; lastDate: string }>();
    return new Map(rows.map((r) => [r.residentId, r.lastDate]));
  }

  // `manager` opcional: roda dentro de uma transação externa (commit do import
  // em lote, story 103), para as contribuições retroativas nascerem atômicas com
  // o resident.
  async bulkCreateContributions(
    residentId: string,
    dto: BulkCreateContributionsDto,
    staffUserId: string,
    manager?: EntityManager,
  ): Promise<{ created: number; skipped: number }> {
    const repo = manager ? manager.getRepository(ResidentFollowUp) : this.repo;
    const staffRepo = manager ? manager.getRepository(Staff) : this.staffRepo;
    const staff = await staffRepo.findOne({ where: { userId: staffUserId } });

    const existing = await repo.find({
      where: { residentId, type: FollowUpType.MONTHLY_CONTRIBUTION },
      select: ['date'],
    });
    const existingKeys = new Set(
      existing.map((e) => (e.date as unknown as string).slice(0, 7)),
    );

    const toCreate = dto.months.filter((m) => !existingKeys.has(m.date.slice(0, 7)));
    const residentRepo = manager ? manager.getRepository(Resident) : this.residentRepo;
    const houseId = toCreate.length
      ? (await residentRepo.findOne({ where: { id: residentId } }))?.houseId
      : null;

    if (toCreate.length > 0) {
      // Story 199: um evento por lançamento criado, na mesma transação; a
      // correlação (requisição) agrupa o lote. Sem snapshot do lote inteiro.
      await this.audit.inTransaction(async (tx) => {
        const txRepo = tx.getRepository(ResidentFollowUp);
        const entries = toCreate.map((m) =>
          txRepo.create({
            residentId,
            date: m.date as unknown as Date,
            type: FollowUpType.MONTHLY_CONTRIBUTION,
            description: null,
            accessLevel: FollowUpAccessLevel.ALL,
            createdById: staff?.id ?? null,
          }),
        );
        const saved = await txRepo.save(entries);
        for (const entry of saved ?? entries) {
          await this.audit.recordChange(tx, {
            action: AuditAction.RESIDENT_CONTRIBUTION_BULK,
            targetType: AuditTargetType.RESIDENT_FOLLOW_UP,
            targetId: entry.id ?? null,
            parentType: AuditTargetType.RESIDENT,
            parentId: residentId,
            houseId: houseId ?? null,
            changes: diffSnapshots(FOLLOW_UP_AUDIT_FIELDS, null, entry as unknown as AuditSnapshot),
          });
        }
      }, manager);
    }

    return { created: toCreate.length, skipped: dto.months.length - toCreate.length };
  }

  async createAuto(
    residentId: string,
    type: FollowUpType,
    date?: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(ResidentFollowUp) : this.repo;
    const today = date ?? new Date().toISOString().split('T')[0];
    const entry = repo.create({
      residentId,
      date: today as unknown as Date,
      type,
      description: null,
      accessLevel: FollowUpAccessLevel.ALL,
      createdById: null,
    });
    await repo.save(entry);
  }

  async uploadAttachment(followUpId: string, residentId: string, file: Express.Multer.File): Promise<ResidentFollowUpView> {
    const followUp = await this.repo.findOne({ where: { id: followUpId, residentId }, relations: ['createdBy'] });
    if (!followUp) throw new NotFoundException(`Follow-up ${followUpId} not found`);

    if (followUp.attachmentUrl) {
      await this.storageService.delete(followUp.attachmentUrl);
    }

    const filename = this.storageService.uniqueFilename(file.originalname, 'comprovante_');
    const url = await this.storageService.upload('attachments', filename, file.buffer, file.mimetype);
    await this.audit.track({
      action: AuditAction.RESIDENT_FOLLOW_UP_ATTACHMENT,
      targetType: AuditTargetType.RESIDENT_FOLLOW_UP,
      targetId: followUpId,
      fields: FOLLOW_UP_AUDIT_FIELDS,
      load: loadById(ResidentFollowUp),
      scope: () => ({ parentType: AuditTargetType.RESIDENT, parentId: residentId }),
      write: (m) => m.getRepository(ResidentFollowUp).update(followUpId, { attachmentUrl: url }),
    });

    const updated = await this.repo.findOne({ where: { id: followUpId }, relations: ['createdBy'] });
    return this.toView(updated!);
  }

  private toView(item: ResidentFollowUp): ResidentFollowUpView {
    return {
      id: item.id,
      residentId: item.residentId,
      date: item.date as unknown as string,
      type: item.type,
      description: item.description,
      accessLevel: item.accessLevel,
      attachmentUrl: item.attachmentUrl,
      createdById: item.createdById,
      createdByName: (item.createdBy as Staff | null)?.name ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FollowUpAccessLevel, FollowUpType, Role, ResidentStatus } from '@fonte/types';
import { ResidentFollowUp } from './resident-follow-up.entity';
import { Staff } from '../staff/staff.entity';
import { Resident } from '../resident/resident.entity';
import { CreateFollowUpDto } from './dto/create-follow-up.dto';
import { StorageService } from '../storage/storage.service';

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
  ) {}

  async findByResident(residentId: string, role: string): Promise<ResidentFollowUpView[]> {
    const qb = this.repo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.createdBy', 'staff')
      .where('f.resident_id = :residentId', { residentId })
      .andWhere('f.deleted_at IS NULL');

    if (role === Role.OPERATOR) {
      qb.andWhere('f.access_level = :level', { level: FollowUpAccessLevel.ALL });
    }

    qb.orderBy('f.date', 'DESC').addOrderBy('f.created_at', 'DESC');

    const items = await qb.getMany();
    return items.map((item) => this.toView(item));
  }

  async create(residentId: string, dto: CreateFollowUpDto, staffUserId: string): Promise<ResidentFollowUpView> {
    const staff = await this.staffRepo.findOne({ where: { userId: staffUserId } });

    // OPERATOR can only create ALL-level events
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
    const saved = await this.repo.save(entry);

    // Status-changing events: update resident directly (bypass ResidentService to avoid loop)
    const newStatus = STATUS_BY_TYPE[dto.type];
    if (newStatus) {
      await this.residentRepo.update(residentId, {
        status: newStatus,
        exitDate: dto.date as unknown as Date,
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

  async createAuto(residentId: string, type: FollowUpType, date?: string): Promise<void> {
    const today = date ?? new Date().toISOString().split('T')[0];
    const entry = this.repo.create({
      residentId,
      date: today as unknown as Date,
      type,
      description: null,
      accessLevel: FollowUpAccessLevel.ALL,
      createdById: null,
    });
    await this.repo.save(entry);
  }

  async uploadAttachment(followUpId: string, residentId: string, file: Express.Multer.File): Promise<ResidentFollowUpView> {
    const followUp = await this.repo.findOne({ where: { id: followUpId, residentId }, relations: ['createdBy'] });
    if (!followUp) throw new NotFoundException(`Follow-up ${followUpId} not found`);

    if (followUp.attachmentUrl) {
      await this.storageService.delete(followUp.attachmentUrl);
    }

    const filename = this.storageService.uniqueFilename(file.originalname, 'comprovante_');
    const url = await this.storageService.upload('attachments', filename, file.buffer, file.mimetype);
    await this.repo.update(followUpId, { attachmentUrl: url });

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

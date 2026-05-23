import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FollowUpAccessLevel, FollowUpType, Role } from '@fonte/types';
import { ResidentFollowUp } from './resident-follow-up.entity';
import { Staff } from '../staff/staff.entity';
import { CreateFollowUpDto } from './dto/create-follow-up.dto';

export interface ResidentFollowUpView {
  id: string;
  residentId: string;
  date: string;
  type: FollowUpType;
  description: string | null;
  accessLevel: FollowUpAccessLevel;
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
    const loaded = await this.repo.findOne({ where: { id: saved.id }, relations: ['createdBy'] });
    return this.toView(loaded!);
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

  private toView(item: ResidentFollowUp): ResidentFollowUpView {
    return {
      id: item.id,
      residentId: item.residentId,
      date: item.date as unknown as string,
      type: item.type,
      description: item.description,
      accessLevel: item.accessLevel,
      createdById: item.createdById,
      createdByName: (item.createdBy as Staff | null)?.name ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}

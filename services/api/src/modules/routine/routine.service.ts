import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoutineEntry } from './routine.entity';
import { CreateRoutineEntryDto } from './dto/create-routine-entry.dto';
import { UpdateRoutineEntryDto } from './dto/update-routine-entry.dto';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class RoutineService {
  constructor(
    @InjectRepository(RoutineEntry)
    private repo: Repository<RoutineEntry>,
  ) {}

  findAll(houseId?: string, residentId?: string): Promise<RoutineEntry[]> {
    const where: Record<string, string> = {};
    if (houseId) where.houseId = houseId;
    if (residentId) where.residentId = residentId;
    return this.repo.find({
      where,
      relations: ['responsible', 'resident'],
      order: { date: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<RoutineEntry> {
    const entry = await this.repo.findOne({
      where: { id },
      relations: ['responsible', 'resident'],
    });
    if (!entry) throw new NotFoundException(`Routine entry ${id} not found`);
    return entry;
  }

  create(dto: CreateRoutineEntryDto): Promise<RoutineEntry> {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateRoutineEntryDto): Promise<RoutineEntry> {
    const entry = await this.findOne(id);
    const ageMs = Date.now() - entry.createdAt.getTime();
    if (ageMs > TWENTY_FOUR_HOURS_MS) {
      throw new BadRequestException('Routine entry cannot be edited after 24 hours');
    }
    await this.repo.update(id, dto);
    return this.findOne(id);
  }
}

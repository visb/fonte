import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident } from './incident.entity';
import { CreateIncidentDto } from './dto/create-incident.dto';

@Injectable()
export class IncidentService {
  constructor(
    @InjectRepository(Incident)
    private repo: Repository<Incident>,
  ) {}

  findAll(houseId?: string, residentId?: string): Promise<Incident[]> {
    const where: Record<string, string> = {};
    if (houseId) where.houseId = houseId;
    if (residentId) where.residentId = residentId;
    return this.repo.find({
      where,
      relations: ['responsible', 'resident'],
      order: { date: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Incident> {
    const incident = await this.repo.findOne({
      where: { id },
      relations: ['responsible', 'resident'],
    });
    if (!incident) throw new NotFoundException(`Incident ${id} not found`);
    return incident;
  }

  create(dto: CreateIncidentDto): Promise<Incident> {
    return this.repo.save(this.repo.create(dto));
  }
}

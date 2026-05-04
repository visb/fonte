import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ministry } from './ministry.entity';
import { CreateMinistryDto } from './dto/create-ministry.dto';
import { UpdateMinistryDto } from './dto/update-ministry.dto';

@Injectable()
export class MinistryService {
  constructor(
    @InjectRepository(Ministry)
    private repo: Repository<Ministry>,
  ) {}

  findAll(): Promise<Ministry[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Ministry> {
    const ministry = await this.repo.findOne({ where: { id } });
    if (!ministry) throw new NotFoundException(`Ministry ${id} not found`);
    return ministry;
  }

  create(dto: CreateMinistryDto): Promise<Ministry> {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateMinistryDto): Promise<Ministry> {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.softDelete(id);
  }
}

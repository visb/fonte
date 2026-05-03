import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Relative } from './relative.entity';
import { CreateRelativeDto } from './dto/create-relative.dto';

@Injectable()
export class RelativeService {
  constructor(
    @InjectRepository(Relative)
    private relativeRepository: Repository<Relative>,
  ) {}

  findByResident(residentId: string): Promise<Relative[]> {
    return this.relativeRepository.find({
      where: { residentId },
      order: { name: 'ASC' },
    });
  }

  create(dto: CreateRelativeDto): Promise<Relative> {
    const relative = this.relativeRepository.create(dto);
    return this.relativeRepository.save(relative);
  }

  async remove(id: string): Promise<void> {
    const count = await this.relativeRepository.count({ where: { id } });
    if (!count) throw new NotFoundException(`Relative ${id} not found`);
    await this.relativeRepository.softDelete(id);
  }
}

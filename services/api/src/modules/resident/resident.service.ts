import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { mkdir, rename } from 'fs/promises';
import { basename, dirname, join } from 'path';
import { Resident } from './resident.entity';
import { CreateResidentDto } from './dto/create-resident.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';

@Injectable()
export class ResidentService implements OnModuleInit {
  constructor(
    @InjectRepository(Resident)
    private residentRepository: Repository<Resident>,
  ) {}

  async onModuleInit() {
    await mkdir(join(process.cwd(), 'uploads', 'residents'), { recursive: true });
  }

  findAll(): Promise<Resident[]> {
    return this.residentRepository.find({
      relations: ['house'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Resident> {
    const resident = await this.residentRepository.findOne({
      where: { id },
      relations: ['house'],
    });
    if (!resident) throw new NotFoundException(`Resident ${id} not found`);
    return resident;
  }

  create(dto: CreateResidentDto): Promise<Resident> {
    const resident = this.residentRepository.create(dto);
    return this.residentRepository.save(resident);
  }

  async update(id: string, dto: UpdateResidentDto): Promise<Resident> {
    await this.findOne(id);
    await this.residentRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.residentRepository.softDelete(id);
  }

  async uploadPhoto(residentId: string, file: Express.Multer.File): Promise<Resident> {
    const resident = await this.findOne(residentId);
    if (resident.photoUrl) {
      const filename = basename(resident.photoUrl);
      const fullPath = join(process.cwd(), 'uploads', 'residents', filename);
      try {
        await rename(fullPath, join(dirname(fullPath), `~${filename}`));
      } catch {
        // arquivo pode não existir no disco
      }
    }
    await this.residentRepository.update(residentId, {
      photoUrl: `/uploads/residents/${file.filename}`,
    });
    return this.findOne(residentId);
  }
}

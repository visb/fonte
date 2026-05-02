import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { House } from './house.entity';
import { CreateHouseDto } from './dto/create-house.dto';
import { UpdateHouseDto } from './dto/update-house.dto';

@Injectable()
export class HouseService {
  constructor(
    @InjectRepository(House)
    private houseRepository: Repository<House>,
  ) {}

  findAll(): Promise<House[]> {
    return this.houseRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<House> {
    const house = await this.houseRepository.findOne({ where: { id } });
    if (!house) throw new NotFoundException(`House ${id} not found`);
    return house;
  }

  create(dto: CreateHouseDto): Promise<House> {
    const house = this.houseRepository.create(dto);
    return this.houseRepository.save(house);
  }

  async update(id: string, dto: UpdateHouseDto): Promise<House> {
    await this.findOne(id);
    await this.houseRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.houseRepository.softDelete(id);
  }
}

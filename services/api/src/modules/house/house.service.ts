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

  async findAll(): Promise<Array<House & { activeResidentsCount: number; staffCount: number }>> {
    const [houses, residentCounts, staffCounts] = await Promise.all([
      this.houseRepository.find({ order: { name: 'ASC' } }),
      this.houseRepository.manager.query<Array<{ houseId: string; count: string }>>(
        `SELECT house_id AS "houseId", COUNT(id)::int AS count
         FROM residents
         WHERE status = $1 AND deleted_at IS NULL
         GROUP BY house_id`,
        ['ACTIVE'],
      ),
      this.houseRepository.manager.query<Array<{ houseId: string; count: string }>>(
        `SELECT house_id AS "houseId", COUNT(id)::int AS count
         FROM staff
         WHERE deleted_at IS NULL
         GROUP BY house_id`,
      ),
    ]);

    const residentMap = new Map(residentCounts.map((c) => [c.houseId, Number(c.count)]));
    const staffMap = new Map(staffCounts.map((c) => [c.houseId, Number(c.count)]));

    return houses.map((h) =>
      Object.assign(h, {
        activeResidentsCount: residentMap.get(h.id) ?? 0,
        staffCount: staffMap.get(h.id) ?? 0,
      }),
    );
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

import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { House } from './house.entity';
import { HousePhoto } from './house-photo.entity';
import { CreateHouseDto } from './dto/create-house.dto';
import { UpdateHouseDto } from './dto/update-house.dto';

@Injectable()
export class HouseService implements OnModuleInit {
  constructor(
    @InjectRepository(House)
    private houseRepository: Repository<House>,
    @InjectRepository(HousePhoto)
    private photoRepository: Repository<HousePhoto>,
  ) {}

  async onModuleInit() {
    await mkdir(join(process.cwd(), 'uploads', 'houses'), { recursive: true });
  }

  async findAll(): Promise<
    Array<House & { activeResidentsCount: number; staffCount: number; thumbnailUrl: string | null }>
  > {
    const [houses, residentCounts, staffCounts, thumbnails] = await Promise.all([
      this.houseRepository.find({
        order: { name: 'ASC' },
        relations: ['coordinator'],
      }),
      this.houseRepository.manager.query<Array<{ houseId: string; count: string }>>(
        `SELECT house_id AS "houseId", COUNT(id)::int AS count
         FROM residents
         WHERE status = $1 AND deleted_at IS NULL
         GROUP BY house_id`,
        ['ACTIVE'],
      ),
      this.houseRepository.manager.query<Array<{ houseId: string; count: string }>>(
        `SELECT house_id AS "houseId", COUNT(DISTINCT id)::int AS count
         FROM staff
         WHERE deleted_at IS NULL
         GROUP BY house_id`,
      ),
      this.houseRepository.manager.query<Array<{ houseId: string; thumbnailUrl: string }>>(
        `SELECT DISTINCT ON (house_id) house_id AS "houseId", url AS "thumbnailUrl"
         FROM house_photos
         ORDER BY house_id, created_at ASC`,
      ),
    ]);

    const residentMap = new Map(residentCounts.map((c) => [c.houseId, Number(c.count)]));
    const staffMap = new Map(staffCounts.map((c) => [c.houseId, Number(c.count)]));
    const thumbnailMap = new Map(thumbnails.map((t) => [t.houseId, t.thumbnailUrl]));

    return houses.map((h) =>
      Object.assign(h, {
        activeResidentsCount: residentMap.get(h.id) ?? 0,
        staffCount: staffMap.get(h.id) ?? 0,
        thumbnailUrl: thumbnailMap.get(h.id) ?? null,
      }),
    );
  }

  async findOne(id: string): Promise<House & { activeResidentsCount: number; staffCount: number }> {
    const [house, residentCounts, staffCounts] = await Promise.all([
      this.houseRepository.findOne({
        where: { id },
        relations: ['coordinator', 'photos'],
      }),
      this.houseRepository.manager.query<Array<{ count: string }>>(
        `SELECT COUNT(id)::int AS count FROM residents WHERE house_id = $1 AND status = $2 AND deleted_at IS NULL`,
        [id, 'ACTIVE'],
      ),
      this.houseRepository.manager.query<Array<{ count: string }>>(
        `SELECT COUNT(DISTINCT id)::int AS count FROM staff WHERE house_id = $1 AND deleted_at IS NULL`,
        [id],
      ),
    ]);
    if (!house) throw new NotFoundException(`House ${id} not found`);
    if (house.photos) {
      house.photos.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }
    return Object.assign(house, {
      activeResidentsCount: Number(residentCounts[0]?.count ?? 0),
      staffCount: Number(staffCounts[0]?.count ?? 0),
    });
  }

  create(dto: CreateHouseDto): Promise<House> {
    const house = this.houseRepository.create(dto);
    return this.houseRepository.save(house);
  }

  async update(id: string, dto: UpdateHouseDto): Promise<House> {
    const count = await this.houseRepository.count({ where: { id } });
    if (!count) throw new NotFoundException(`House ${id} not found`);
    await this.houseRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const count = await this.houseRepository.count({ where: { id } });
    if (!count) throw new NotFoundException(`House ${id} not found`);
    await this.houseRepository.softDelete(id);
  }

  async addPhoto(houseId: string, file: Express.Multer.File): Promise<HousePhoto> {
    const count = await this.houseRepository.count({ where: { id: houseId } });
    if (!count) throw new NotFoundException(`House ${houseId} not found`);
    const photo = this.photoRepository.create({
      houseId,
      filename: file.originalname,
      path: file.path,
      url: `/uploads/houses/${file.filename}`,
    });
    return this.photoRepository.save(photo);
  }

  async removePhoto(houseId: string, photoId: string): Promise<void> {
    const photo = await this.photoRepository.findOne({
      where: { id: photoId, houseId },
    });
    if (!photo) throw new NotFoundException(`Photo ${photoId} not found`);
    try {
      await unlink(photo.path);
    } catch {
      // arquivo pode não existir no disco — continua com remoção do registro
    }
    await this.photoRepository.delete(photoId);
  }
}

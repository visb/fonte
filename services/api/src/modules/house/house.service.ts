import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { mkdir, rename } from 'fs/promises';
import { basename, dirname, join } from 'path';
import { House } from './house.entity';
import { HouseMinistry } from './house-ministry.entity';
import { HousePhoto } from './house-photo.entity';
import { HouseRule } from './house-rule.entity';
import { CreateHouseDto } from './dto/create-house.dto';
import { CreateHouseMinistryDto } from './dto/create-house-ministry.dto';
import { CreateHouseRuleDto } from './dto/create-house-rule.dto';
import { UpdateHouseDto } from './dto/update-house.dto';
import { UpdateHouseMinistryDto } from './dto/update-house-ministry.dto';

@Injectable()
export class HouseService implements OnModuleInit {
  constructor(
    @InjectRepository(House)
    private houseRepository: Repository<House>,
    @InjectRepository(HousePhoto)
    private photoRepository: Repository<HousePhoto>,
    @InjectRepository(HouseMinistry)
    private houseMinistryRepo: Repository<HouseMinistry>,
    @InjectRepository(HouseRule)
    private houseRuleRepo: Repository<HouseRule>,
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
      const dir = dirname(photo.path);
      const filename = basename(photo.path);
      await rename(photo.path, join(dir, `~${filename}`));
    } catch {
      // arquivo pode não existir no disco — continua com remoção do registro
    }
    await this.photoRepository.delete(photoId);
  }

  // ─── Residents ──────────────────────────────────────────────────────────────

  async findResidents(houseId: string): Promise<
    Array<{ id: string; name: string; status: string; entryDate: string | null; photoUrl: string | null }>
  > {
    await this.assertHouseExists(houseId);
    return this.houseRepository.manager.query(
      `SELECT id, name, status, entry_date AS "entryDate", photo_url AS "photoUrl"
       FROM residents
       WHERE house_id = $1 AND deleted_at IS NULL
       ORDER BY name`,
      [houseId],
    );
  }

  // ─── Staff ──────────────────────────────────────────────────────────────────

  async findStaffForHouse(houseId: string): Promise<
    Array<{ id: string; name: string; phone: string | null }>
  > {
    await this.assertHouseExists(houseId);
    return this.houseRepository.manager.query(
      `SELECT id, name, phone FROM staff WHERE house_id = $1 AND deleted_at IS NULL ORDER BY name`,
      [houseId],
    );
  }

  // ─── Ministries ─────────────────────────────────────────────────────────────

  async findMinistries(houseId: string): Promise<
    Array<{ id: string; ministryId: string; ministryName: string; leaderId: string | null; leaderName: string | null }>
  > {
    await this.assertHouseExists(houseId);
    return this.houseRepository.manager.query(
      `SELECT hm.id, m.id AS "ministryId", m.name AS "ministryName",
              s.id AS "leaderId", s.name AS "leaderName"
       FROM house_ministries hm
       JOIN ministries m ON m.id = hm.ministry_id AND m.deleted_at IS NULL
       LEFT JOIN staff s ON s.id = hm.leader_id AND s.deleted_at IS NULL
       WHERE hm.house_id = $1
       ORDER BY m.name`,
      [houseId],
    );
  }

  async addMinistry(houseId: string, dto: CreateHouseMinistryDto): Promise<HouseMinistry> {
    await this.assertHouseExists(houseId);
    const [ministryCount] = await this.houseRepository.manager.query<[{ count: number }]>(
      `SELECT COUNT(*)::int AS count FROM ministries WHERE id = $1 AND deleted_at IS NULL`,
      [dto.ministryId],
    );
    if (!ministryCount.count) throw new NotFoundException(`Ministry ${dto.ministryId} not found`);

    const existing = await this.houseMinistryRepo.findOne({
      where: { houseId, ministryId: dto.ministryId },
    });
    if (existing) throw new ConflictException('Ministry already added to this house');

    return this.houseMinistryRepo.save(
      this.houseMinistryRepo.create({
        houseId,
        ministryId: dto.ministryId,
        leaderId: dto.leaderId ?? null,
      }),
    );
  }

  async updateMinistry(houseId: string, hmId: string, dto: UpdateHouseMinistryDto): Promise<HouseMinistry> {
    const hm = await this.houseMinistryRepo.findOne({ where: { id: hmId, houseId } });
    if (!hm) throw new NotFoundException(`HouseMinistry ${hmId} not found`);
    hm.leaderId = dto.leaderId;
    return this.houseMinistryRepo.save(hm);
  }

  async removeMinistry(houseId: string, hmId: string): Promise<void> {
    const hm = await this.houseMinistryRepo.findOne({ where: { id: hmId, houseId } });
    if (!hm) throw new NotFoundException(`HouseMinistry ${hmId} not found`);
    await this.houseMinistryRepo.delete(hmId);
  }

  // ─── Rules ──────────────────────────────────────────────────────────────────

  async findRules(houseId: string): Promise<HouseRule[]> {
    await this.assertHouseExists(houseId);
    return this.houseRuleRepo.find({ where: { houseId }, order: { createdAt: 'ASC' } });
  }

  async createRule(houseId: string, dto: CreateHouseRuleDto): Promise<HouseRule> {
    await this.assertHouseExists(houseId);
    return this.houseRuleRepo.save(this.houseRuleRepo.create({ houseId, ...dto }));
  }

  async removeRule(houseId: string, ruleId: string): Promise<void> {
    const rule = await this.houseRuleRepo.findOne({ where: { id: ruleId, houseId } });
    if (!rule) throw new NotFoundException(`Rule ${ruleId} not found`);
    await this.houseRuleRepo.softDelete(ruleId);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async assertHouseExists(houseId: string): Promise<void> {
    const count = await this.houseRepository.count({ where: { id: houseId } });
    if (!count) throw new NotFoundException(`House ${houseId} not found`);
  }
}

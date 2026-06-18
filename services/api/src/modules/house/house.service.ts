import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PRESENT_RESIDENT_STATUSES } from '@fonte/types';
import { House } from './house.entity';
import { HousePhoto } from './house-photo.entity';
import { HouseRule } from './house-rule.entity';
import { CreateHouseDto } from './dto/create-house.dto';
import { CreateHouseRuleDto } from './dto/create-house-rule.dto';
import { UpdateHouseDto } from './dto/update-house.dto';
import { StorageService } from '../storage/storage.service';
import { CacheService } from '../cache/cache.service';
import { RESIDENT_COUNTS_CHANGED_EVENT } from '../../common/events/resident-counts.event';

@Injectable()
export class HouseService {
  // Mapa { houseId: contagem de filhos presentes }. Fonte única de findAll/findOne;
  // invalidado por evento (RESIDENT_COUNTS_CHANGED_EVENT) + TTL de segurança.
  private static readonly RESIDENT_COUNTS_KEY = 'house:resident-counts';
  private static readonly RESIDENT_COUNTS_TTL = 3600;

  constructor(
    @InjectRepository(House)
    private houseRepository: Repository<House>,
    @InjectRepository(HousePhoto)
    private photoRepository: Repository<HousePhoto>,
    @InjectRepository(HouseRule)
    private houseRuleRepo: Repository<HouseRule>,
    private storageService: StorageService,
    private cache: CacheService,
  ) {}

  /**
   * Contagem de filhos presentes por casa, cacheada no Redis. No miss roda o
   * GROUP BY e grava com TTL; invalidada por {@link RESIDENT_COUNTS_CHANGED_EVENT}.
   */
  private async getResidentCountsMap(): Promise<Record<string, number>> {
    const cached = await this.cache.get<Record<string, number>>(
      HouseService.RESIDENT_COUNTS_KEY,
    );
    if (cached) return cached;

    const rows = await this.houseRepository.manager.query<
      Array<{ houseId: string; count: string }>
    >(
      `SELECT house_id AS "houseId", COUNT(id)::int AS count
       FROM residents
       WHERE status = ANY($1) AND deleted_at IS NULL
       GROUP BY house_id`,
      [[...PRESENT_RESIDENT_STATUSES]],
    );

    const map: Record<string, number> = {};
    for (const r of rows) map[r.houseId] = Number(r.count);
    await this.cache.set(
      HouseService.RESIDENT_COUNTS_KEY,
      map,
      HouseService.RESIDENT_COUNTS_TTL,
    );
    return map;
  }

  /** Descarta o cache da contagem de filhos quando um resident muda. */
  @OnEvent(RESIDENT_COUNTS_CHANGED_EVENT)
  async invalidateResidentCounts(): Promise<void> {
    await this.cache.del(HouseService.RESIDENT_COUNTS_KEY);
  }

  async findAll(): Promise<
    Array<House & { activeResidentsCount: number; staffCount: number; thumbnailUrl: string | null }>
  > {
    const [houses, residentMap, staffCounts, thumbnails] = await Promise.all([
      this.houseRepository.find({
        order: { name: 'ASC' },
        relations: ['coordinator'],
      }),
      this.getResidentCountsMap(),
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

    const staffMap = new Map(staffCounts.map((c) => [c.houseId, Number(c.count)]));
    const thumbnailMap = new Map(thumbnails.map((t) => [t.houseId, t.thumbnailUrl]));

    return houses.map((h) =>
      Object.assign(h, {
        activeResidentsCount: residentMap[h.id] ?? 0,
        staffCount: staffMap.get(h.id) ?? 0,
        thumbnailUrl: thumbnailMap.get(h.id) ?? null,
      }),
    );
  }

  async findOne(id: string): Promise<House & { activeResidentsCount: number; staffCount: number }> {
    const [house, residentMap, staffCounts] = await Promise.all([
      this.houseRepository.findOne({
        where: { id },
        relations: ['coordinator', 'photos'],
      }),
      this.getResidentCountsMap(),
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
      activeResidentsCount: residentMap[id] ?? 0,
      staffCount: Number(staffCounts[0]?.count ?? 0),
    });
  }

  async create(dto: CreateHouseDto): Promise<House> {
    // Clear before saving: partial unique index rejects two mother houses at once.
    if (dto.isMotherHouse) await this.clearOtherMotherHouses();
    const house = this.houseRepository.create(dto);
    return this.houseRepository.save(house);
  }

  async update(id: string, dto: UpdateHouseDto): Promise<House> {
    const count = await this.houseRepository.count({ where: { id } });
    if (!count) throw new NotFoundException(`House ${id} not found`);
    // Clear before updating: partial unique index rejects two mother houses at once.
    if (dto.isMotherHouse) await this.clearOtherMotherHouses(id);
    await this.houseRepository.update(id, dto);
    return this.findOne(id);
  }

  /** Only one house can be the mother house; unmark all others. */
  private async clearOtherMotherHouses(keepId?: string): Promise<void> {
    const qb = this.houseRepository
      .createQueryBuilder()
      .update(House)
      .set({ isMotherHouse: false })
      .where('is_mother_house = true');
    if (keepId) qb.andWhere('id != :keepId', { keepId });
    await qb.execute();
  }

  async remove(id: string): Promise<void> {
    const count = await this.houseRepository.count({ where: { id } });
    if (!count) throw new NotFoundException(`House ${id} not found`);
    await this.houseRepository.softDelete(id);
  }

  async addPhoto(houseId: string, file: Express.Multer.File): Promise<HousePhoto> {
    const count = await this.houseRepository.count({ where: { id: houseId } });
    if (!count) throw new NotFoundException(`House ${houseId} not found`);
    const filename = this.storageService.uniqueFilename(file.originalname);
    const url = await this.storageService.upload('houses', filename, file.buffer, file.mimetype);
    const photo = this.photoRepository.create({
      houseId,
      filename: file.originalname,
      path: url,
      url,
    });
    return this.photoRepository.save(photo);
  }

  async removePhoto(houseId: string, photoId: string): Promise<void> {
    const photo = await this.photoRepository.findOne({
      where: { id: photoId, houseId },
    });
    if (!photo) throw new NotFoundException(`Photo ${photoId} not found`);
    await this.storageService.delete(photo.url);
    await this.photoRepository.delete(photoId);
  }

  // ─── Residents ──────────────────────────────────────────────────────────────

  async findResidents(houseId: string): Promise<
    Array<{
      id: string;
      name: string;
      status: string;
      entryDate: string | null;
      photoUrl: string | null;
      photoThumbUrl: string | null;
    }>
  > {
    await this.assertHouseExists(houseId);
    return this.houseRepository.manager.query(
      `SELECT id, name, status, entry_date AS "entryDate",
              photo_url AS "photoUrl", photo_thumb_url AS "photoThumbUrl"
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

  async assertHouseExists(houseId: string): Promise<void> {
    const count = await this.houseRepository.count({ where: { id: houseId } });
    if (!count) throw new NotFoundException(`House ${houseId} not found`);
  }
}

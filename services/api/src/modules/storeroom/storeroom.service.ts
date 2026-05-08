import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MovementType } from '@fonte/types';
import { StoreroomItem } from './storeroom.entity';
import { StoreroomMovement } from './storeroom-movement.entity';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { CreateMovementDto } from './dto/create-movement.dto';

const WEEKLY_AVERAGE_LOCK_KEY = 'storeroom_weekly_average_usage';
const WEEKLY_AVERAGE_WINDOW_DAYS = 28;
const WEEKLY_AVERAGE_WINDOW_WEEKS = 4;

export interface WeeklyAverageConsolidationResult {
  skipped: boolean;
  windowStart: string;
  windowEnd: string;
  updatedItems: number;
}

@Injectable()
export class StoreroomService {
  constructor(
    @InjectRepository(StoreroomItem)
    private itemRepo: Repository<StoreroomItem>,
    @InjectRepository(StoreroomMovement)
    private movementRepo: Repository<StoreroomMovement>,
    private dataSource: DataSource,
  ) {}

  findItems(houseId?: string): Promise<StoreroomItem[]> {
    return this.itemRepo.find({
      where: houseId ? { houseId } : {},
      order: { name: 'ASC' },
    });
  }

  async findItem(id: string): Promise<StoreroomItem> {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Storeroom item ${id} not found`);
    return item;
  }

  createItem(dto: CreateItemDto): Promise<StoreroomItem> {
    return this.itemRepo.save(this.itemRepo.create(dto));
  }

  async updateItem(id: string, dto: UpdateItemDto): Promise<StoreroomItem> {
    await this.findItem(id);
    await this.itemRepo.update(id, dto);
    return this.findItem(id);
  }

  async removeItem(id: string): Promise<void> {
    await this.findItem(id);
    await this.itemRepo.softDelete(id);
  }

  findMovements(houseId?: string, itemId?: string): Promise<StoreroomMovement[]> {
    const qb = this.movementRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.item', 'item')
      .leftJoinAndSelect('m.responsible', 'responsible')
      .orderBy('m.date', 'DESC')
      .addOrderBy('m.createdAt', 'DESC');

    if (itemId) qb.andWhere('m.item_id = :itemId', { itemId });
    if (houseId) qb.andWhere('item.house_id = :houseId', { houseId });

    return qb.getMany();
  }

  async createMovement(dto: CreateMovementDto): Promise<StoreroomMovement> {
    const item = await this.findItem(dto.itemId);

    const newQty =
      dto.type === MovementType.IN
        ? Number(item.currentQuantity) + dto.quantity
        : Number(item.currentQuantity) - dto.quantity;

    if (newQty < 0) {
      throw new BadRequestException('Insufficient stock for this movement');
    }

    await this.itemRepo.update(item.id, { currentQuantity: newQty });
    return this.movementRepo.save(this.movementRepo.create(dto));
  }

  async consolidateWeeklyAverageUsage(referenceDate = new Date()): Promise<WeeklyAverageConsolidationResult> {
    const { windowStart, windowEnd } = this.getWeeklyAverageWindow(referenceDate);
    const lock = await this.dataSource.query(
      `SELECT pg_try_advisory_lock(hashtext($1)) AS acquired`,
      [WEEKLY_AVERAGE_LOCK_KEY],
    );
    const acquired = lock[0]?.acquired === true;

    if (!acquired) {
      return { skipped: true, windowStart, windowEnd, updatedItems: 0 };
    }

    try {
      const updatedItems = await this.updateWeeklyAverageUsage(windowStart, windowEnd);
      return { skipped: false, windowStart, windowEnd, updatedItems };
    } finally {
      await this.dataSource.query(
        `SELECT pg_advisory_unlock(hashtext($1))`,
        [WEEKLY_AVERAGE_LOCK_KEY],
      );
    }
  }

  private getWeeklyAverageWindow(referenceDate: Date): { windowStart: string; windowEnd: string } {
    const windowEndDate = new Date(Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
    ));
    const windowStartDate = new Date(windowEndDate);
    windowStartDate.setUTCDate(windowStartDate.getUTCDate() - WEEKLY_AVERAGE_WINDOW_DAYS);

    return {
      windowStart: this.formatDateOnly(windowStartDate),
      windowEnd: this.formatDateOnly(windowEndDate),
    };
  }

  private formatDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private async updateWeeklyAverageUsage(windowStart: string, windowEnd: string): Promise<number> {
    const updated = await this.dataSource.query(
      `
        WITH usage AS (
          SELECT
            i.id AS item_id,
            COALESCE(SUM(m.quantity), 0) AS total_quantity
          FROM storeroom_items i
          LEFT JOIN storeroom_movements m
            ON m.item_id = i.id
           AND m.type = $1
           AND m.date >= $2
           AND m.date < $3
          WHERE i.deleted_at IS NULL
          GROUP BY i.id
        )
        UPDATE storeroom_items i
        SET
          weekly_average_usage = ROUND((usage.total_quantity / $4)::numeric, 3),
          weekly_average_calculated_at = now(),
          weekly_average_window_start = $2,
          weekly_average_window_end = $3,
          updated_at = now()
        FROM usage
        WHERE i.id = usage.item_id
          AND i.deleted_at IS NULL
        RETURNING i.id
      `,
      [MovementType.OUT, windowStart, windowEnd, WEEKLY_AVERAGE_WINDOW_WEEKS],
    );

    return updated.length;
  }
}

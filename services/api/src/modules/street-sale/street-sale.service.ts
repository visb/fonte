import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  StreetSaleType,
  StreetSalesReportResponse,
  StreetSalesReportPeriod,
  StreetSalesReportByHouse,
  StreetSale as StreetSaleDto,
} from '@fonte/types';
import { StreetSale } from './street-sale.entity';
import { Staff } from '../staff/staff.entity';
import { CreateStreetSaleDto } from './dto/create-street-sale.dto';
import { UpdateStreetSaleDto } from './dto/update-street-sale.dto';
import { GetStreetSalesReportDto } from './dto/get-street-sales-report.dto';

const EDIT_WINDOW_MS = 60 * 60 * 1000;

@Injectable()
export class StreetSaleService {
  constructor(
    @InjectRepository(StreetSale)
    private repo: Repository<StreetSale>,
    @InjectRepository(Staff)
    private staffRepo: Repository<Staff>,
  ) {}

  async create(dto: CreateStreetSaleDto, staffUserId: string): Promise<StreetSaleDto> {
    const staff = await this.staffRepo.findOne({ where: { userId: staffUserId } });
    const sale = this.repo.create({
      houseId: dto.houseId,
      registeredById: staff?.id ?? null,
      date: dto.date,
      type: dto.type,
      quantity: dto.quantity,
      amountPix: dto.amountPix,
      amountCash: dto.amountCash,
      amountCard: dto.amountCard,
    });
    const saved = await this.repo.save(sale);
    const loaded = await this.repo.findOne({
      where: { id: saved.id },
      relations: ['house'],
    });
    return this.toView(loaded!);
  }

  async findOne(id: string): Promise<StreetSaleDto> {
    const sale = await this.repo.findOne({ where: { id }, relations: ['house'] });
    if (!sale) throw new NotFoundException('Street sale not found');
    return this.toView(sale);
  }

  async update(id: string, dto: UpdateStreetSaleDto): Promise<StreetSaleDto> {
    const sale = await this.repo.findOne({ where: { id }, relations: ['house'] });
    if (!sale) throw new NotFoundException('Street sale not found');
    if (Date.now() - sale.createdAt.getTime() > EDIT_WINDOW_MS) {
      throw new ForbiddenException('Edit window of 60 minutes has expired');
    }
    Object.assign(sale, dto);
    const saved = await this.repo.save(sale);
    const loaded = await this.repo.findOne({ where: { id: saved.id }, relations: ['house'] });
    return this.toView(loaded!);
  }

  async remove(id: string): Promise<void> {
    const sale = await this.repo.findOne({ where: { id } });
    if (!sale) throw new NotFoundException('Street sale not found');
    if (Date.now() - sale.createdAt.getTime() > EDIT_WINDOW_MS) {
      throw new ForbiddenException('Delete window of 60 minutes has expired');
    }
    await this.repo.delete(id);
  }

  async findAll(houseId?: string, type?: StreetSaleType): Promise<StreetSaleDto[]> {
    const qb = this.repo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.house', 'house')
      .orderBy('s.date', 'DESC')
      .addOrderBy('s.created_at', 'DESC');

    if (houseId) qb.andWhere('s.house_id = :houseId', { houseId });
    if (type) qb.andWhere('s.type = :type', { type });

    const items = await qb.getMany();
    return items.map((s) => this.toView(s));
  }

  async getReport(dto: GetStreetSalesReportDto): Promise<StreetSalesReportResponse> {
    const [year, month] = dto.month.split('-').map(Number);

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 1));

    const prevMonthStart = new Date(Date.UTC(year, month - 2, 1));
    const prevMonthEnd = monthStart;

    const qb = this.repo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.house', 'house')
      .where('s.type = :type', { type: dto.type })
      .andWhere('s.date >= :start', { start: prevMonthStart.toISOString().slice(0, 10) })
      .andWhere('s.date < :end', { end: monthEnd.toISOString().slice(0, 10) });

    if (dto.houseId) qb.andWhere('s.house_id = :houseId', { houseId: dto.houseId });

    const all = await qb.getMany();

    const currentMonth = all.filter((s) => {
      const d = new Date(s.date);
      return d >= monthStart && d < monthEnd;
    });
    const previousMonth = all.filter((s) => {
      const d = new Date(s.date);
      return d >= prevMonthStart && d < prevMonthEnd;
    });

    const weeklyTotals = this.buildWeeklyTotals(currentMonth, monthStart, monthEnd);
    const monthlyTotals = this.buildMonthlyTotals(dto.type, year, month, dto.houseId);
    const byHouse = this.buildByHouse(currentMonth);

    const sumTotal = (items: StreetSale[]) =>
      items.reduce((acc, s) => acc + s.amountPix + s.amountCash + s.amountCard, 0);

    return {
      type: dto.type,
      weeklyTotals,
      monthlyTotals: await monthlyTotals,
      byHouse,
      currentPeriodTotal: sumTotal(currentMonth),
      previousPeriodTotal: sumTotal(previousMonth),
    };
  }

  private buildWeeklyTotals(items: StreetSale[], monthStart: Date, monthEnd: Date): StreetSalesReportPeriod[] {
    const weeks: StreetSalesReportPeriod[] = [];
    const cursor = new Date(monthStart);

    while (cursor < monthEnd) {
      const weekStart = new Date(cursor);
      const weekEnd = new Date(cursor);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
      if (weekEnd > monthEnd) weekEnd.setTime(monthEnd.getTime());

      const weekItems = items.filter((s) => {
        const d = new Date(s.date + 'T00:00:00Z');
        return d >= weekStart && d < weekEnd;
      });

      weeks.push(this.aggregatePeriod(weekStart.toISOString().slice(0, 10), weekItems));
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }

    return weeks;
  }

  private async buildMonthlyTotals(
    type: StreetSaleType,
    year: number,
    month: number,
    houseId?: string,
  ): Promise<StreetSalesReportPeriod[]> {
    const months: StreetSalesReportPeriod[] = [];

    for (let i = 5; i >= 0; i--) {
      let m = month - i;
      let y = year;
      while (m <= 0) { m += 12; y--; }

      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 1));

      const qb = this.repo
        .createQueryBuilder('s')
        .where('s.type = :type', { type })
        .andWhere('s.date >= :start', { start: start.toISOString().slice(0, 10) })
        .andWhere('s.date < :end', { end: end.toISOString().slice(0, 10) });

      if (houseId) qb.andWhere('s.house_id = :houseId', { houseId });

      const items = await qb.getMany();
      months.push(this.aggregatePeriod(`${y}-${String(m).padStart(2, '0')}`, items));
    }

    return months;
  }

  private buildByHouse(items: StreetSale[]): StreetSalesReportByHouse[] {
    const map = new Map<string, StreetSalesReportByHouse>();

    for (const s of items) {
      const key = s.houseId;
      if (!map.has(key)) {
        map.set(key, {
          houseId: s.houseId,
          houseName: s.house?.name ?? s.houseId,
          totalPix: 0,
          totalCash: 0,
          totalCard: 0,
          totalAmount: 0,
          totalQuantity: 0,
        });
      }
      const entry = map.get(key)!;
      entry.totalPix += s.amountPix;
      entry.totalCash += s.amountCash;
      entry.totalCard += s.amountCard;
      entry.totalAmount += s.amountPix + s.amountCash + s.amountCard;
      entry.totalQuantity += s.quantity;
    }

    return [...map.values()].sort((a, b) => b.totalAmount - a.totalAmount);
  }

  private aggregatePeriod(period: string, items: StreetSale[]): StreetSalesReportPeriod {
    return items.reduce(
      (acc, s) => ({
        period,
        totalPix: acc.totalPix + s.amountPix,
        totalCash: acc.totalCash + s.amountCash,
        totalCard: acc.totalCard + s.amountCard,
        totalAmount: acc.totalAmount + s.amountPix + s.amountCash + s.amountCard,
        totalQuantity: acc.totalQuantity + s.quantity,
      }),
      { period, totalPix: 0, totalCash: 0, totalCard: 0, totalAmount: 0, totalQuantity: 0 },
    );
  }

  private toView(sale: StreetSale): StreetSaleDto {
    return {
      id: sale.id,
      houseId: sale.houseId,
      houseName: sale.house?.name ?? sale.houseId,
      registeredById: sale.registeredById ?? '',
      date: sale.date,
      type: sale.type,
      quantity: sale.quantity,
      amountPix: sale.amountPix,
      amountCash: sale.amountCash,
      amountCard: sale.amountCard,
      totalAmount: sale.amountPix + sale.amountCash + sale.amountCard,
      createdAt: sale.createdAt.toISOString(),
    };
  }
}

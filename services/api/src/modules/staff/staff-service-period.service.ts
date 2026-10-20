import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  AuditAction,
  AuditTargetType,
  findServicePeriodDatesIssue,
  findServicePeriodOverlap,
  SERVICE_PERIOD_MESSAGES,
  todayInSaoPaulo,
} from '@fonte/types';
import { StaffServicePeriod } from './staff-service-period.entity';
import { Staff } from './staff.entity';
import { House } from '../house/house.entity';
import { AuditService, defaultScope, loadById } from '../audit/audit.service';
import { STAFF_SERVICE_PERIOD_AUDIT_FIELDS } from '../audit/audit-fields';
import { CreateServicePeriodDto } from './dto/create-service-period.dto';
import { UpdateServicePeriodDto } from './dto/update-service-period.dto';

type DateValue = string | Date | null | undefined;

/** `YYYY-MM-DD` de um valor vindo do DTO (string) ou da entidade (Date/string). */
function isoDate(value: DateValue): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

interface Period {
  id?: string;
  startDate: string | null;
  endDate: string | null;
}

function toPeriod(row: StaffServicePeriod): Period {
  return { id: row.id, startDate: isoDate(row.startDate), endDate: isoDate(row.endDate) };
}

/** Violação do índice único parcial "um período aberto por staff". */
function isOpenPeriodViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '23505';
}

/**
 * Story 216 — abre o período de serviço na transação de quem cria o staff
 * (promoção do filho ou cadastro direto). Falha aqui desfaz a criação.
 */
export function openServicePeriod(
  manager: EntityManager,
  params: { staffId: string; houseId: string | null; startDate: string },
): Promise<StaffServicePeriod> {
  const repo = manager.getRepository(StaffServicePeriod);
  return repo.save(
    repo.create({
      staffId: params.staffId,
      houseId: params.houseId,
      startDate: params.startDate,
      endDate: null,
    }),
  );
}

/**
 * Story 216 — períodos de serviço da aba Histórico do servo. Leitura para
 * staff; escrita só ADMIN (gate no controller). Período **aberto** só corrige
 * o início — o fim é do desligamento (story 217). Sem delete.
 */
@Injectable()
export class StaffServicePeriodService {
  constructor(
    @InjectRepository(StaffServicePeriod)
    private periodRepository: Repository<StaffServicePeriod>,
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
    @InjectRepository(House)
    private houseRepository: Repository<House>,
    private audit: AuditService,
  ) {}

  async findServicePeriods(staffId: string): Promise<StaffServicePeriod[]> {
    await this.assertStaff(staffId);
    return this.periodRepository.find({
      where: { staffId },
      relations: { house: true },
      order: { startDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async createServicePeriod(staffId: string, dto: CreateServicePeriodDto): Promise<StaffServicePeriod> {
    await this.assertStaff(staffId);
    const periods = await this.periodRepository.find({ where: { staffId } });
    if (!dto.endDate) {
      const hasOpen = periods.some((period) => !period.endDate);
      throw new BadRequestException(
        hasOpen ? SERVICE_PERIOD_MESSAGES.alreadyOpen : SERVICE_PERIOD_MESSAGES.endDateRequired,
      );
    }
    await this.assertHouse(dto.houseId);
    const period = { startDate: isoDate(dto.startDate), endDate: isoDate(dto.endDate) };
    this.assertDates(period);
    this.assertNoOverlap(period, periods);

    const saved = await this.track(undefined, AuditAction.STAFF_SERVICE_PERIOD_CREATE, staffId, (manager) => {
      const repo = manager.getRepository(StaffServicePeriod);
      return repo.save(
        repo.create({
          staffId,
          houseId: dto.houseId ?? null,
          startDate: period.startDate!,
          endDate: period.endDate,
        }),
      );
    });
    return this.reload(saved.id);
  }

  async updateServicePeriod(
    staffId: string,
    periodId: string,
    dto: UpdateServicePeriodDto,
  ): Promise<StaffServicePeriod> {
    await this.assertStaff(staffId);
    const periods = await this.periodRepository.find({ where: { staffId } });
    const target = periods.find((period) => period.id === periodId);
    if (!target) throw new NotFoundException(`Período de serviço ${periodId} não encontrado`);

    const isOpen = !target.endDate;
    if (isOpen && (dto.endDate !== undefined || dto.houseId !== undefined)) {
      throw new BadRequestException(SERVICE_PERIOD_MESSAGES.openOnlyStartDate);
    }
    if (dto.houseId !== undefined) await this.assertHouse(dto.houseId);

    const previous = toPeriod(target);
    const next: Period = {
      id: target.id,
      startDate: dto.startDate !== undefined ? isoDate(dto.startDate) : previous.startDate,
      endDate: dto.endDate !== undefined ? isoDate(dto.endDate) : previous.endDate,
    };
    const datesChanged = next.startDate !== previous.startDate || next.endDate !== previous.endDate;
    if (datesChanged) {
      this.assertDates(next);
      this.assertNoOverlap(next, periods);
    }

    const update: Partial<StaffServicePeriod> = {};
    if (dto.houseId !== undefined) update.houseId = dto.houseId;
    if (next.startDate !== previous.startDate) update.startDate = next.startDate!;
    if (next.endDate !== previous.endDate) update.endDate = next.endDate;
    if (Object.keys(update).length > 0) {
      await this.track(target.id, AuditAction.STAFF_SERVICE_PERIOD_UPDATE, staffId, (manager) =>
        manager.getRepository(StaffServicePeriod).update(target.id, update),
      );
    }
    return this.reload(target.id);
  }

  private async track<R>(
    periodId: string | undefined,
    action: string,
    staffId: string,
    write: (manager: EntityManager) => Promise<R>,
  ): Promise<R> {
    try {
      return await this.audit.track<R>({
        action,
        targetType: AuditTargetType.STAFF_SERVICE_PERIOD,
        targetId: periodId,
        fields: STAFF_SERVICE_PERIOD_AUDIT_FIELDS,
        load: loadById(StaffServicePeriod),
        lockTable: periodId ? 'staff_service_periods' : undefined,
        resolveId: (result) => (result as unknown as StaffServicePeriod).id,
        scope: ({ before, after }) => ({
          ...defaultScope(before, after),
          parentType: AuditTargetType.STAFF,
          parentId: staffId,
        }),
        write,
      });
    } catch (error) {
      // Corrida com outra escrita: o índice parcial é a última barreira —
      // devolve a mensagem amigável, não o erro cru do Postgres.
      if (isOpenPeriodViolation(error)) {
        throw new BadRequestException(SERVICE_PERIOD_MESSAGES.alreadyOpen);
      }
      throw error;
    }
  }

  private async assertStaff(staffId: string): Promise<void> {
    const exists = await this.staffRepository.exists({ where: { id: staffId } });
    if (!exists) throw new NotFoundException(`Staff ${staffId} not found`);
  }

  private async assertHouse(houseId: string | null | undefined): Promise<void> {
    if (!houseId) return;
    const exists = await this.houseRepository.exists({ where: { id: houseId } });
    if (!exists) throw new BadRequestException('Casa não encontrada.');
  }

  private assertDates(period: Period): void {
    const issue = findServicePeriodDatesIssue(period, todayInSaoPaulo());
    if (issue) throw new BadRequestException(issue.message);
  }

  private assertNoOverlap(period: Period, periods: StaffServicePeriod[]): void {
    const overlap = findServicePeriodOverlap(period, periods.map(toPeriod));
    if (overlap) {
      throw new BadRequestException(SERVICE_PERIOD_MESSAGES.overlap(overlap.startDate, overlap.endDate));
    }
  }

  private reload(id: string): Promise<StaffServicePeriod> {
    return this.periodRepository.findOneOrFail({ where: { id }, relations: { house: true } });
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  FamilyInvestment,
  NotificationType,
  PaymentMethod,
  ReceivableStatus,
  ResidentStatus,
  Role,
} from '@fonte/types';
import { ResidentReceivable } from './resident-receivable.entity';
import { Resident } from '../resident/resident.entity';
import { Staff } from '../staff/staff.entity';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { StorageService } from '../storage/storage.service';
import { NotificationService } from '../notification/notification.service';

const TREATMENT_MONTHS = 6;

const CANONICAL_AMOUNTS: Partial<Record<FamilyInvestment, number>> = {
  [FamilyInvestment.BASKET_500]: 500,
  [FamilyInvestment.PAYMENT_700]: 700,
  [FamilyInvestment.SOCIAL]: 0,
};

// Statuses where the resident is still under treatment and the carnê keeps rolling.
const ACTIVE_STATUSES: ResidentStatus[] = [
  ResidentStatus.PRE_ADMISSION,
  ResidentStatus.ACTIVE,
  ResidentStatus.DISCIPLINE,
  ResidentStatus.TEMP_LEAVE,
];

export interface ResidentReceivableView {
  id: string;
  residentId: string;
  referenceMonth: string;
  dueDate: string;
  amount: number;
  familyInvestment: FamilyInvestment;
  paidAmount: number | null;
  paidFamilyInvestment: FamilyInvestment | null;
  mandatory: boolean;
  status: ReceivableStatus;
  paidAt: string | null;
  paymentMethod: PaymentMethod | null;
  attachmentUrl: string | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: Date;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

function refMonthStr(year: number, month0: number): string {
  return `${year}-${pad(month0 + 1)}-01`;
}

function dueDateStr(year: number, month0: number, dueDay: number): string {
  const day = Math.min(dueDay, daysInMonth(year, month0));
  return `${year}-${pad(month0 + 1)}-${pad(day)}`;
}

// Absolute month index (year*12 + month0) for easy comparison/iteration.
function monthIndex(year: number, month0: number): number {
  return year * 12 + month0;
}

function parseYearMonth(dateStr: string): { year: number; month0: number; day: number } {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return { year: y, month0: m - 1, day: d };
}

function resolveAmount(plan: FamilyInvestment, amount: number | null): number {
  if (plan === FamilyInvestment.NEGOTIATED) return amount ?? 0;
  return CANONICAL_AMOUNTS[plan] ?? 0;
}

@Injectable()
export class ResidentReceivableService {
  private readonly logger = new Logger(ResidentReceivableService.name);

  constructor(
    @InjectRepository(ResidentReceivable)
    private repo: Repository<ResidentReceivable>,
    @InjectRepository(Resident)
    private residentRepo: Repository<Resident>,
    @InjectRepository(Staff)
    private staffRepo: Repository<Staff>,
    private storageService: StorageService,
    private notifications: NotificationService,
  ) {}

  async findByResident(residentId: string): Promise<ResidentReceivableView[]> {
    const resident = await this.residentRepo.findOne({ where: { id: residentId } });
    if (!resident) throw new NotFoundException(`Resident ${residentId} not found`);

    if (ACTIVE_STATUSES.includes(resident.status)) {
      await this.ensureFutureOpen(resident);
    }

    const items = await this.repo
      .createQueryBuilder('rcv')
      .leftJoinAndSelect('rcv.createdBy', 'staff')
      .where('rcv.resident_id = :residentId', { residentId })
      .andWhere('rcv.deleted_at IS NULL')
      .orderBy('rcv.reference_month', 'ASC')
      .getMany();

    return items.map((item) => this.toView(item));
  }

  /** Latest paid reference month per resident — feeds the list "next due" badge. */
  async getLastPaidDates(residentIds: string[]): Promise<Map<string, string>> {
    if (residentIds.length === 0) return new Map();
    const rows = await this.repo
      .createQueryBuilder('rcv')
      .select('rcv.resident_id', 'residentId')
      .addSelect('MAX(rcv.reference_month)', 'lastMonth')
      .where('rcv.resident_id IN (:...residentIds)', { residentIds })
      .andWhere('rcv.status = :paid', { paid: ReceivableStatus.PAID })
      .andWhere('rcv.deleted_at IS NULL')
      .groupBy('rcv.resident_id')
      .getRawMany<{ residentId: string; lastMonth: string }>();
    return new Map(rows.map((r) => [r.residentId, String(r.lastMonth).slice(0, 10)]));
  }

  /** Generates the 6 mandatory installments from entry_date (idempotent). */
  async generateSchedule(residentId: string): Promise<void> {
    const resident = await this.residentRepo.findOne({ where: { id: residentId } });
    if (!resident || !resident.entryDate) return;
    const startIdx = this.startIndex(resident);
    if (startIdx == null) return;
    await this.materializeUpTo(resident, startIdx + TREATMENT_MONTHS - 1);
  }

  /** Rolls the carnê so there is always at least one open month ahead while active. */
  async ensureFutureOpen(resident: Resident): Promise<void> {
    const startIdx = this.startIndex(resident);
    if (startIdx == null) return;
    const now = new Date();
    const currentIdx = monthIndex(now.getFullYear(), now.getMonth());
    const untilIdx = Math.max(startIdx + TREATMENT_MONTHS - 1, currentIdx + 1);
    await this.materializeUpTo(resident, untilIdx);
  }

  /** Recomputes amount/due date/plan for future PENDING installments after a plan change. */
  async recalcFuturePending(residentId: string): Promise<void> {
    const resident = await this.residentRepo.findOne({ where: { id: residentId } });
    if (!resident) return;

    const plan = resident.familyInvestment;

    // SOCIAL or exempt → cancel future pending and stop.
    if (!plan || plan === FamilyInvestment.SOCIAL || resident.contributionExempt) {
      await this.cancelFuturePending(residentId);
      return;
    }

    // Coming back to a paying plan → (re)materialize the obligatory window.
    await this.generateSchedule(residentId);

    const amount = resolveAmount(plan, resident.familyInvestmentAmount);
    const dueDay = this.dueDay(resident);
    const firstFutureMonth = refMonthStr(new Date().getFullYear(), new Date().getMonth());

    const future = await this.repo.find({
      where: { residentId, status: ReceivableStatus.PENDING },
    });
    const toUpdate = future.filter(
      (r) => String(r.referenceMonth).slice(0, 10) >= firstFutureMonth,
    );
    for (const r of toUpdate) {
      const { year, month0 } = parseYearMonth(String(r.referenceMonth));
      r.amount = amount;
      r.familyInvestment = plan;
      r.dueDate = dueDateStr(year, month0, dueDay) as unknown as Date;
    }
    if (toUpdate.length > 0) await this.repo.save(toUpdate);
  }

  /** Cancels future PENDING mandatory installments (used when marking exempt). */
  async cancelFuturePending(residentId: string): Promise<void> {
    const firstFutureMonth = refMonthStr(new Date().getFullYear(), new Date().getMonth());
    const pending = await this.repo.find({
      where: { residentId, status: ReceivableStatus.PENDING },
    });
    const ids = pending
      .filter((r) => String(r.referenceMonth).slice(0, 10) >= firstFutureMonth)
      .map((r) => r.id);
    if (ids.length > 0) {
      await this.repo.update({ id: In(ids) }, { status: ReceivableStatus.CANCELED });
    }
  }

  /** Cancels PENDING installments whose reference month is after the exit month. */
  async cancelAfterExit(residentId: string, exitDate: string): Promise<void> {
    const { year, month0 } = parseYearMonth(exitDate);
    const exitMonth = refMonthStr(year, month0);
    const pending = await this.repo.find({
      where: { residentId, status: ReceivableStatus.PENDING },
    });
    const ids = pending
      .filter((r) => String(r.referenceMonth).slice(0, 10) > exitMonth)
      .map((r) => r.id);
    if (ids.length > 0) {
      await this.repo.update({ id: In(ids) }, { status: ReceivableStatus.CANCELED });
    }
  }

  async registerPayment(
    residentId: string,
    receivableId: string,
    dto: RegisterPaymentDto,
    staffUserId: string,
    file?: Express.Multer.File,
  ): Promise<ResidentReceivableView> {
    const receivable = await this.repo.findOne({ where: { id: receivableId, residentId } });
    if (!receivable) throw new NotFoundException(`Receivable ${receivableId} not found`);

    const staff = await this.staffRepo.findOne({ where: { userId: staffUserId } });

    let attachmentUrl = receivable.attachmentUrl;
    if (file) {
      if (attachmentUrl) await this.storageService.delete(attachmentUrl);
      const filename = this.storageService.uniqueFilename(file.originalname, 'comprovante_');
      attachmentUrl = await this.storageService.upload('attachments', filename, file.buffer, file.mimetype);
    }

    await this.repo.update(receivableId, {
      status: ReceivableStatus.PAID,
      paidAt: dto.paidAt as unknown as Date,
      paymentMethod: dto.paymentMethod,
      paidAmount: dto.paidAmount ?? receivable.amount,
      paidFamilyInvestment: dto.paidFamilyInvestment ?? receivable.familyInvestment,
      notes: dto.notes ?? null,
      attachmentUrl,
      createdById: staff?.id ?? null,
    });

    const updated = await this.repo.findOne({ where: { id: receivableId }, relations: ['createdBy'] });

    await this.notifyPaymentRegistered(residentId, updated!);

    return this.toView(updated!);
  }

  // Best-effort: a failure here must never break the payment registration.
  private async notifyPaymentRegistered(
    residentId: string,
    receivable: ResidentReceivable,
  ): Promise<void> {
    try {
      const resident = await this.residentRepo.findOne({ where: { id: residentId } });
      const residentName = resident?.name ?? 'Acolhido';
      const amount = receivable.paidAmount ?? receivable.amount;
      await this.notifications.create({
        type: NotificationType.PAYMENT_REGISTERED,
        title: 'Pagamento registrado',
        body: `Pagamento de R$ ${amount} registrado para ${residentName}.`,
        link: `/residents/${residentId}`,
        recipientRole: Role.ADMIN,
        metadata: { entityId: receivable.id, residentId },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to emit PAYMENT_REGISTERED notification for receivable ${receivable.id}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  async reopenPayment(residentId: string, receivableId: string): Promise<ResidentReceivableView> {
    const receivable = await this.repo.findOne({ where: { id: receivableId, residentId } });
    if (!receivable) throw new NotFoundException(`Receivable ${receivableId} not found`);

    if (receivable.attachmentUrl) await this.storageService.delete(receivable.attachmentUrl);

    await this.repo.update(receivableId, {
      status: ReceivableStatus.PENDING,
      paidAt: null,
      paymentMethod: null,
      paidAmount: null,
      paidFamilyInvestment: null,
      notes: null,
      attachmentUrl: null,
      createdById: null,
    });

    const updated = await this.repo.findOne({ where: { id: receivableId }, relations: ['createdBy'] });
    return this.toView(updated!);
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private startIndex(resident: Resident): number | null {
    if (!resident.entryDate) return null;
    if (resident.contributionExempt) return null;
    const plan = resident.familyInvestment;
    if (!plan || plan === FamilyInvestment.SOCIAL) return null;
    const { year, month0 } = parseYearMonth(String(resident.entryDate));
    return monthIndex(year, month0);
  }

  private dueDay(resident: Resident): number {
    if (resident.contributionDueDay) return resident.contributionDueDay;
    return parseYearMonth(String(resident.entryDate)).day;
  }

  /** Creates any missing installments from the entry month through untilIdx (inclusive). */
  private async materializeUpTo(resident: Resident, untilIdx: number): Promise<void> {
    const startIdx = this.startIndex(resident);
    if (startIdx == null || untilIdx < startIdx) return;

    const plan = resident.familyInvestment!;
    const amount = resolveAmount(plan, resident.familyInvestmentAmount);
    const dueDay = this.dueDay(resident);

    const existing = await this.repo.find({
      where: { residentId: resident.id },
      select: ['referenceMonth'],
    });
    const existingKeys = new Set(existing.map((e) => String(e.referenceMonth).slice(0, 7)));

    const toCreate: ResidentReceivable[] = [];
    for (let idx = startIdx; idx <= untilIdx; idx++) {
      const year = Math.floor(idx / 12);
      const month0 = idx % 12;
      const key = `${year}-${pad(month0 + 1)}`;
      if (existingKeys.has(key)) continue;
      toCreate.push(
        this.repo.create({
          residentId: resident.id,
          referenceMonth: refMonthStr(year, month0) as unknown as Date,
          dueDate: dueDateStr(year, month0, dueDay) as unknown as Date,
          amount,
          familyInvestment: plan,
          mandatory: idx - startIdx < TREATMENT_MONTHS,
          status: ReceivableStatus.PENDING,
        }),
      );
    }
    if (toCreate.length > 0) await this.repo.save(toCreate);
  }

  private toView(item: ResidentReceivable): ResidentReceivableView {
    return {
      id: item.id,
      residentId: item.residentId,
      referenceMonth: String(item.referenceMonth).slice(0, 10),
      dueDate: String(item.dueDate).slice(0, 10),
      amount: item.amount,
      familyInvestment: item.familyInvestment,
      paidAmount: item.paidAmount,
      paidFamilyInvestment: item.paidFamilyInvestment,
      mandatory: item.mandatory,
      status: item.status,
      paidAt: item.paidAt ? String(item.paidAt).slice(0, 10) : null,
      paymentMethod: item.paymentMethod,
      attachmentUrl: item.attachmentUrl,
      notes: item.notes,
      createdByName: (item.createdBy as Staff | null)?.name ?? null,
      createdAt: item.createdAt,
    };
  }
}

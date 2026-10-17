import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import {
  ACTIVE_RESIDENT_STATUSES,
  AuditAction,
  AuditTargetType,
  FamilyInvestment,
  NotificationType,
  PaymentMethod,
  ReceivableStatus,
  RelativePaidReceivable,
  ResidentReceivableSummary,
  ResidentStatus,
  Role,
} from '@fonte/types';
import { ResidentReceivable } from './resident-receivable.entity';
import { Admission } from '../resident/admission.entity';
import {
  resolveAdmissionIdForMonth,
  resolveCurrentAdmissionId,
} from '../resident/admission-resolution';
import { Resident } from '../resident/resident.entity';
import { Staff } from '../staff/staff.entity';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { StorageService } from '../storage/storage.service';
import { NotificationService } from '../notification/notification.service';
import { toDbTimestamp } from '../../common/lib/db-timestamp';
import { AuditService, loadById } from '../audit/audit.service';
import { RECEIVABLE_AUDIT_FIELDS } from '../audit/audit-fields';
import {
  ProductContributionView,
  ReceivableProductContributionService,
} from './receivable-product-contribution.service';

const TREATMENT_MONTHS = 6;

const CANONICAL_AMOUNTS: Partial<Record<FamilyInvestment, number>> = {
  [FamilyInvestment.BASKET_500]: 500,
  [FamilyInvestment.PAYMENT_700]: 700,
  [FamilyInvestment.SOCIAL]: 0,
};

// Statuses where the resident is still under treatment and the carnê keeps
// rolling. Story 160 — definição ÚNICA de "filho ativo", em @fonte/types.
const ACTIVE_STATUSES: ResidentStatus[] = ACTIVE_RESIDENT_STATUSES;

export interface ResidentReceivableView {
  id: string;
  residentId: string;
  // Acolhimento dono da parcela (story 164); null em parcela órfã (dado legado).
  admissionId: string | null;
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
  productContributions: ProductContributionView[];
}

/**
 * O recorte do carnê (story 186) com o dono da parcela: o pacote offline agrupa
 * por filho, e sem `residentId` cada linha voltaria a precisar do carnê cheio
 * para se localizar. Continua sem valor, pagamento e histórico.
 */
export interface ResidentReceivableSummaryView extends ResidentReceivableSummary {
  residentId: string;
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

/**
 * Monta o recorte (story 186) a partir da linha já projetada. Os três campos são
 * escritos um a um de propósito: espalhar a entidade aqui (`...item`) devolveria
 * ao cliente qualquer coluna que a projeção passasse a trazer.
 */
function toSummary(item: Pick<ResidentReceivable, 'id' | 'referenceMonth' | 'status'>): ResidentReceivableSummary {
  return {
    id: item.id,
    referenceMonth: String(item.referenceMonth).slice(0, 10),
    status: item.status,
  };
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
    @InjectRepository(Admission)
    private admissionRepo: Repository<Admission>,
    @InjectRepository(Staff)
    private staffRepo: Repository<Staff>,
    private storageService: StorageService,
    private notifications: NotificationService,
    private productContributions: ReceivableProductContributionService,
    // Story 199 — último de propósito: os anteriores são contrato dos specs.
    private audit: AuditService,
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

    const contributionsByReceivable = await this.productContributions.mapByReceivables(
      items.map((item) => item.id),
    );

    return items.map((item) =>
      this.toView(item, contributionsByReceivable.get(item.id) ?? []),
    );
  }

  /**
   * Recorte do carnê de UM filho (story 186) — o que a tela de contribuição em
   * produtos do `ops.fonte` precisa para achar a parcela: mês e status.
   *
   * A projeção é feita **no repositório** (`select` das colunas do recorte), não
   * por `map()` sobre a entidade cheia: recorte que só existe na saída volta a
   * vazar no dia em que alguém logar o objeto ou reusar o método.
   *
   * Rola o carnê como `findByResident` faz: o servo tem que enxergar a mesma
   * parcela corrente que o `adm.fonte` mostra, senão declararia produto no mês
   * errado.
   */
  async findSummaryByResident(residentId: string): Promise<ResidentReceivableSummary[]> {
    const resident = await this.residentRepo.findOne({ where: { id: residentId } });
    if (!resident) throw new NotFoundException(`Resident ${residentId} not found`);

    if (ACTIVE_STATUSES.includes(resident.status)) {
      await this.ensureFutureOpen(resident);
    }

    const items = await this.repo
      .createQueryBuilder('rcv')
      .select(['rcv.id', 'rcv.referenceMonth', 'rcv.status'])
      .where('rcv.resident_id = :residentId', { residentId })
      .andWhere('rcv.deleted_at IS NULL')
      .orderBy('rcv.reference_month', 'ASC')
      .getMany();

    return items.map((item) => toSummary(item));
  }

  /**
   * Story 193 — recorte do carnê para o FAMILIAR: só as parcelas **PAGAS** do
   * filho, e só o que a tela de recibos do `app.fonte` precisa (competência,
   * valor pago, data e forma de pagamento).
   *
   * Projeção no repositório, pelo mesmo motivo do recorte do `ops.fonte`: campo
   * que só some na saída volta a vazar no dia em que alguém reusar o método.
   * Nada de plano, produtos ou anotação — e nada de parcela pendente/vencida:
   * cobrar pelo app do familiar é decisão de produto que ninguém tomou
   * (decisão 11).
   *
   * Não roda `ensureFutureOpen`: materializar carnê a partir de um GET do
   * familiar seria escrita disparada por leitura — e parcela futura, pendente
   * por definição, nem entraria nesta lista.
   *
   * `paidAmount` cai para `amount` quando nulo: é o mesmo valor que o recibo
   * imprime (decisão 6), e a tela não pode discordar do PDF.
   */
  async findPaidByResident(residentId: string): Promise<RelativePaidReceivable[]> {
    const items = await this.repo
      .createQueryBuilder('rcv')
      .select([
        'rcv.id',
        'rcv.referenceMonth',
        'rcv.amount',
        'rcv.paidAmount',
        'rcv.paidAt',
        'rcv.paymentMethod',
      ])
      .where('rcv.resident_id = :residentId', { residentId })
      .andWhere('rcv.status = :status', { status: ReceivableStatus.PAID })
      .andWhere('rcv.deleted_at IS NULL')
      .orderBy('rcv.reference_month', 'DESC')
      .getMany();

    return items.map((item) => ({
      id: item.id,
      referenceMonth: String(item.referenceMonth).slice(0, 10),
      paidAmount: item.paidAmount ?? item.amount,
      paidAt: item.paidAt ? String(item.paidAt).slice(0, 10) : null,
      paymentMethod: item.paymentMethod,
    }));
  }

  /**
   * Lote (story 177) do recorte (story 186): parcelas de N filhos numa consulta
   * só, para o snapshot offline da casa. `since` recorta o delta por
   * `updated_at`.
   *
   * O pacote leva o **recorte** — mês e status —, nunca valor ou pagamento: ele
   * desce para toda role de staff e não pode ser o atalho que entrega o
   * financeiro da família ao aparelho de qualquer operador.
   *
   * Diferente de `findSummaryByResident`, **não** roda `ensureFutureOpen`:
   * snapshot é leitura, e materializar carnê a cada volta do foreground de cada
   * aparelho seria escrita disparada por GET.
   */
  async findSummariesByResidents(
    residentIds: string[],
    since?: Date,
  ): Promise<ResidentReceivableSummaryView[]> {
    if (residentIds.length === 0) return [];

    const qb = this.repo
      .createQueryBuilder('rcv')
      .select(['rcv.id', 'rcv.residentId', 'rcv.referenceMonth', 'rcv.status'])
      .where('rcv.resident_id IN (:...residentIds)', { residentIds })
      .andWhere('rcv.deleted_at IS NULL');

    if (since) {
      qb.andWhere('rcv.updated_at > :since', { since: toDbTimestamp(since) });
    }

    const items = await qb.orderBy('rcv.reference_month', 'ASC').getMany();

    return items.map((item) => ({ ...toSummary(item), residentId: item.residentId }));
  }

  /** Ids apagados desde `since` (story 177) — o app remove do store local. */
  async findDeletedIdsSince(residentIds: string[], since: Date): Promise<string[]> {
    if (residentIds.length === 0) return [];
    const rows = await this.repo
      .createQueryBuilder('rcv')
      .select('rcv.id', 'id')
      .withDeleted()
      .where('rcv.resident_id IN (:...residentIds)', { residentIds })
      .andWhere('rcv.deleted_at > :since', { since: toDbTimestamp(since) })
      .getRawMany<{ id: string }>();
    return rows.map((row) => row.id);
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

  // ── vínculo parcela → acolhimento (story 164) ────────────────────────────

  /** Admissões vivas do filho; uma consulta só serve o lote inteiro de competências. */
  private async loadAdmissions(residentId: string, manager?: EntityManager): Promise<Admission[]> {
    const repo = manager ? manager.getRepository(Admission) : this.admissionRepo;
    return repo.find({ where: { residentId } });
  }

  /**
   * Acolhimento dono da competência (decisão 9 da story 164). A regra mora em
   * `admission-resolution.ts` e é a mesma do backfill da migration.
   */
  async resolveAdmissionId(
    residentId: string,
    referenceMonth: string,
    manager?: EntityManager,
  ): Promise<string | null> {
    const admissions = await this.loadAdmissions(residentId, manager);
    return resolveAdmissionIdForMonth(admissions, referenceMonth);
  }

  /** Id do acolhimento atual do filho (entrada mais recente), ou null. */
  async getCurrentAdmissionId(residentId: string, manager?: EntityManager): Promise<string | null> {
    const admissions = await this.loadAdmissions(residentId, manager);
    return resolveCurrentAdmissionId(admissions);
  }

  /**
   * Parcelas em que os ajustes automáticos do carnê podem mexer: as do
   * acolhimento atual e as órfãs. Parcela de acolhimento **encerrado** é
   * histórico — recalcular ou cancelar ali reescreveria o passado.
   */
  private belongsToCurrentAdmission(
    receivable: Pick<ResidentReceivable, 'admissionId'>,
    currentAdmissionId: string | null,
  ): boolean {
    return receivable.admissionId == null || receivable.admissionId === currentAdmissionId;
  }

  /**
   * Generates the 6 mandatory installments from entry_date (idempotent).
   * `manager` opcional: roda dentro de uma transação externa (commit do import).
   */
  async generateSchedule(residentId: string, manager?: EntityManager): Promise<void> {
    const residentRepo = manager ? manager.getRepository(Resident) : this.residentRepo;
    const resident = await residentRepo.findOne({ where: { id: residentId } });
    if (!resident || !resident.entryDate) return;
    const startIdx = this.startIndex(resident);
    if (startIdx == null) return;
    await this.materializeUpTo(resident, startIdx + TREATMENT_MONTHS - 1, manager);
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

    const currentAdmissionId = await this.getCurrentAdmissionId(residentId);
    const future = await this.repo.find({
      where: { residentId, status: ReceivableStatus.PENDING },
    });
    const toUpdate = future.filter(
      (r) =>
        String(r.referenceMonth).slice(0, 10) >= firstFutureMonth &&
        this.belongsToCurrentAdmission(r, currentAdmissionId),
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
    const currentAdmissionId = await this.getCurrentAdmissionId(residentId);
    const pending = await this.repo.find({
      where: { residentId, status: ReceivableStatus.PENDING },
    });
    const ids = pending
      .filter(
        (r) =>
          String(r.referenceMonth).slice(0, 10) >= firstFutureMonth &&
          this.belongsToCurrentAdmission(r, currentAdmissionId),
      )
      .map((r) => r.id);
    if (ids.length > 0) {
      await this.repo.update({ id: In(ids) }, { status: ReceivableStatus.CANCELED });
    }
  }

  /** Cancels PENDING installments whose reference month is after the exit month. */
  async cancelAfterExit(residentId: string, exitDate: string): Promise<void> {
    const { year, month0 } = parseYearMonth(exitDate);
    const exitMonth = refMonthStr(year, month0);
    const currentAdmissionId = await this.getCurrentAdmissionId(residentId);
    const pending = await this.repo.find({
      where: { residentId, status: ReceivableStatus.PENDING },
    });
    const ids = pending
      .filter(
        (r) =>
          String(r.referenceMonth).slice(0, 10) > exitMonth &&
          this.belongsToCurrentAdmission(r, currentAdmissionId),
      )
      .map((r) => r.id);
    if (ids.length > 0) {
      await this.repo.update({ id: In(ids) }, { status: ReceivableStatus.CANCELED });
    }
  }

  /**
   * Marca como pagas as competências vindas do histórico de contribuição da
   * planilha no import em lote. A parcela existente da competência vira PAID
   * (preservando valor/plano da parcela); competência sem parcela (ex.:
   * acolhimento anterior à entrada atual) é criada já paga. Parcela já paga é
   * preservada. `manager` opcional: roda dentro da transação do commit.
   */
  async markImportedPayments(
    residentId: string,
    months: string[],
    manager?: EntityManager,
  ): Promise<{ paid: number; skipped: number }> {
    if (months.length === 0) return { paid: 0, skipped: 0 };
    const residentRepo = manager ? manager.getRepository(Resident) : this.residentRepo;
    const repo = manager ? manager.getRepository(ResidentReceivable) : this.repo;
    const resident = await residentRepo.findOne({ where: { id: residentId } });
    if (!resident) return { paid: 0, skipped: 0 };

    const plan = resident.familyInvestment ?? FamilyInvestment.SOCIAL;
    const amount = resolveAmount(plan, resident.familyInvestmentAmount);
    const dueDay = resident.entryDate ? this.dueDay(resident) : 1;
    const startIdx = this.startIndex(resident);
    const existing = await repo.find({ where: { residentId } });
    const byMonth = new Map(existing.map((r) => [String(r.referenceMonth).slice(0, 7), r]));
    const notes = 'Importado da planilha (histórico de contribuição)';
    // N competências, uma consulta de admissões: a resolução roda em memória.
    const admissions = await this.loadAdmissions(residentId, manager);

    let paid = 0;
    let skipped = 0;
    for (const month of [...new Set(months.map((m) => m.slice(0, 10)))].sort()) {
      const { year, month0 } = parseYearMonth(month);
      const current = byMonth.get(`${year}-${pad(month0 + 1)}`);
      if (current?.status === ReceivableStatus.PAID) {
        skipped += 1;
        continue;
      }
      const dueDate = dueDateStr(year, month0, dueDay);
      const admissionId = resolveAdmissionIdForMonth(admissions, refMonthStr(year, month0));
      if (current) {
        await repo.update(current.id, {
          status: ReceivableStatus.PAID,
          paidAt: dueDate as unknown as Date,
          paidAmount: current.amount,
          paidFamilyInvestment: current.familyInvestment,
          notes,
          // Vínculo já existente é preservado: quem importa não reescreve o passado.
          ...(current.admissionId == null ? { admissionId } : {}),
        });
      } else {
        const idx = monthIndex(year, month0);
        await repo.save(
          repo.create({
            residentId,
            admissionId,
            referenceMonth: refMonthStr(year, month0) as unknown as Date,
            dueDate: dueDate as unknown as Date,
            amount,
            familyInvestment: plan,
            mandatory: startIdx != null && idx >= startIdx && idx - startIdx < TREATMENT_MONTHS,
            status: ReceivableStatus.PAID,
            paidAt: dueDate as unknown as Date,
            paidAmount: amount,
            paidFamilyInvestment: plan,
            notes,
          }),
        );
      }
      paid += 1;
    }
    return { paid, skipped };
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

    await this.trackReceivable(residentId, receivableId, AuditAction.RESIDENT_RECEIVABLE_PAYMENT, (m) =>
      m.getRepository(ResidentReceivable).update(receivableId, {
        status: ReceivableStatus.PAID,
        paidAt: dto.paidAt as unknown as Date,
        paymentMethod: dto.paymentMethod,
        paidAmount: dto.paidAmount ?? receivable.amount,
        paidFamilyInvestment: dto.paidFamilyInvestment ?? receivable.familyInvestment,
        notes: dto.notes ?? null,
        attachmentUrl,
        createdById: staff?.id ?? null,
      }),
    );

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

    await this.trackReceivable(residentId, receivableId, AuditAction.RESIDENT_RECEIVABLE_REOPEN, (m) =>
      m.getRepository(ResidentReceivable).update(receivableId, {
        status: ReceivableStatus.PENDING,
        paidAt: null,
        paymentMethod: null,
        paidAmount: null,
        paidFamilyInvestment: null,
        notes: null,
        attachmentUrl: null,
        createdById: null,
      }),
    );

    const updated = await this.repo.findOne({ where: { id: receivableId }, relations: ['createdBy'] });
    return this.toView(updated!);
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  /** Story 199 — parcela com antes/depois; o filho é o recurso principal. */
  private trackReceivable(
    residentId: string,
    receivableId: string,
    action: string,
    write: (manager: EntityManager) => Promise<unknown>,
  ): Promise<unknown> {
    return this.audit.track({
      action,
      targetType: AuditTargetType.RESIDENT_RECEIVABLE,
      targetId: receivableId,
      fields: RECEIVABLE_AUDIT_FIELDS,
      load: loadById(ResidentReceivable),
      lockTable: 'resident_receivables',
      scope: () => ({ parentType: AuditTargetType.RESIDENT, parentId: residentId }),
      write,
    });
  }

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
  private async materializeUpTo(
    resident: Resident,
    untilIdx: number,
    manager?: EntityManager,
  ): Promise<void> {
    const startIdx = this.startIndex(resident);
    if (startIdx == null || untilIdx < startIdx) return;

    const repo = manager ? manager.getRepository(ResidentReceivable) : this.repo;
    const plan = resident.familyInvestment!;
    const amount = resolveAmount(plan, resident.familyInvestmentAmount);
    const dueDay = this.dueDay(resident);

    const existing = await repo.find({
      where: { residentId: resident.id },
      select: ['referenceMonth'],
    });
    const existingKeys = new Set(existing.map((e) => String(e.referenceMonth).slice(0, 7)));

    // Na prática toda parcela nova cai no acolhimento atual, mas resolvemos pela
    // competência (mesmo resolver do backfill) para escrita e leitura não divergirem.
    const admissions = await this.loadAdmissions(resident.id, manager);

    const toCreate: ResidentReceivable[] = [];
    for (let idx = startIdx; idx <= untilIdx; idx++) {
      const year = Math.floor(idx / 12);
      const month0 = idx % 12;
      const key = `${year}-${pad(month0 + 1)}`;
      if (existingKeys.has(key)) continue;
      toCreate.push(
        repo.create({
          residentId: resident.id,
          admissionId: resolveAdmissionIdForMonth(admissions, refMonthStr(year, month0)),
          referenceMonth: refMonthStr(year, month0) as unknown as Date,
          dueDate: dueDateStr(year, month0, dueDay) as unknown as Date,
          amount,
          familyInvestment: plan,
          mandatory: idx - startIdx < TREATMENT_MONTHS,
          status: ReceivableStatus.PENDING,
        }),
      );
    }
    if (toCreate.length > 0) await repo.save(toCreate);
  }

  private toView(
    item: ResidentReceivable,
    productContributions: ProductContributionView[] = [],
  ): ResidentReceivableView {
    return {
      id: item.id,
      residentId: item.residentId,
      admissionId: item.admissionId ?? null,
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
      productContributions,
    };
  }
}

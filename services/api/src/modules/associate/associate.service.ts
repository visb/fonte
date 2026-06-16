import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import {
  Associate as AssociateDto,
  AssociateCharge as AssociateChargeDto,
  AssociateDetail,
  AssociateListItem,
  AssociateStatus,
  AssociatesOverview,
  PaginatedAssociates,
  AssociatesOverviewMonth,
  AssociateSubscription as AssociateSubscriptionDto,
  ChargeStatus,
  SubscriptionStatus,
} from '@fonte/types';
import { Associate } from './associate.entity';
import { AssociateSubscription } from './associate-subscription.entity';
import { AssociateCharge } from './associate-charge.entity';
import { CreateAssociateDto } from './dto/create-associate.dto';
import { UpdateAssociateDto } from './dto/update-associate.dto';

@Injectable()
export class AssociateService {
  constructor(
    @InjectRepository(Associate)
    private repo: Repository<Associate>,
    @InjectRepository(AssociateSubscription)
    private subscriptionRepo: Repository<AssociateSubscription>,
    @InjectRepository(AssociateCharge)
    private chargeRepo: Repository<AssociateCharge>,
  ) {}

  async create(dto: CreateAssociateDto): Promise<AssociateDto> {
    const associate = this.repo.create({
      name: dto.name,
      whatsapp: dto.whatsapp,
      email: dto.email ?? null,
      contributionAmount: dto.contributionAmount,
      dueDay: dto.dueDay,
      status: AssociateStatus.PENDING,
      paymentToken: randomUUID(),
    });
    const saved = await this.repo.save(associate);
    return this.toView(saved);
  }

  async findAll(
    pagination: { limit?: number; offset?: number } = {},
  ): Promise<PaginatedAssociates> {
    const limit = pagination.limit ?? 20;
    const offset = pagination.offset ?? 0;

    const [associates, total] = await this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    const items = await Promise.all(
      associates.map(async (a) => {
        const lastCharge = await this.chargeRepo.findOne({
          where: { associateId: a.id },
          order: { createdAt: 'DESC' },
        });
        return {
          ...this.toView(a),
          lastCharge: lastCharge ? this.toChargeView(lastCharge) : null,
        };
      }),
    );

    return { items, total };
  }

  /**
   * Overview de faturamento (story 44): série esperado×arrecadado dos últimos N
   * meses + índices do mês corrente. Só leitura, sem N+1 (agrega no banco).
   */
  async getOverview(months = 12): Promise<AssociatesOverview> {
    const span = Math.min(Math.max(Math.trunc(months) || 12, 1), 36);

    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth(); // 0-based
    // Janela [rangeStart, rangeEnd) cobrindo os últimos `span` meses (inclui o corrente).
    const rangeStart = new Date(Date.UTC(currentYear, currentMonth - (span - 1), 1));
    const rangeEnd = new Date(Date.UTC(currentYear, currentMonth + 1, 1));
    const startStr = rangeStart.toISOString().slice(0, 10);
    const endStr = rangeEnd.toISOString().slice(0, 10);

    // Esperado por mês = soma das charges com due_date no mês.
    const expectedRows = await this.chargeRepo
      .createQueryBuilder('c')
      .select("to_char(c.due_date, 'YYYY-MM')", 'month')
      .addSelect('COALESCE(SUM(c.gross_amount), 0)', 'gross')
      .addSelect('COALESCE(SUM(c.net_amount), 0)', 'net')
      .where('c.due_date >= :start', { start: startStr })
      .andWhere('c.due_date < :end', { end: endStr })
      .groupBy('month')
      .getRawMany<{ month: string; gross: string; net: string }>();

    // Arrecadado por mês = soma das charges PAID com paid_at no mês.
    const collectedRows = await this.chargeRepo
      .createQueryBuilder('c')
      .select("to_char(c.paid_at, 'YYYY-MM')", 'month')
      .addSelect('COALESCE(SUM(c.gross_amount), 0)', 'gross')
      .addSelect('COALESCE(SUM(c.net_amount), 0)', 'net')
      .where('c.status = :status', { status: ChargeStatus.PAID })
      .andWhere('c.paid_at >= :start', { start: rangeStart.toISOString() })
      .andWhere('c.paid_at < :end', { end: rangeEnd.toISOString() })
      .groupBy('month')
      .getRawMany<{ month: string; gross: string; net: string }>();

    const expectedByMonth = new Map(expectedRows.map((r) => [r.month, r]));
    const collectedByMonth = new Map(collectedRows.map((r) => [r.month, r]));

    const monthsSeries: AssociatesOverviewMonth[] = [];
    for (let i = 0; i < span; i++) {
      const d = new Date(Date.UTC(currentYear, currentMonth - (span - 1) + i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const exp = expectedByMonth.get(key);
      const col = collectedByMonth.get(key);
      monthsSeries.push({
        month: key,
        expectedGross: Number(exp?.gross ?? 0),
        expectedNet: Number(exp?.net ?? 0),
        collectedGross: Number(col?.gross ?? 0),
        collectedNet: Number(col?.net ?? 0),
      });
    }

    const current = await this.buildCurrentIndices(currentYear, currentMonth, monthsSeries);

    return { months: monthsSeries, current };
  }

  private async buildCurrentIndices(
    year: number,
    month: number,
    monthsSeries: AssociatesOverviewMonth[],
  ): Promise<AssociatesOverview['current']> {
    const monthStart = new Date(Date.UTC(year, month, 1));
    const monthEnd = new Date(Date.UTC(year, month + 1, 1));
    const currentKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const currentSeries = monthsSeries.find((m) => m.month === currentKey);

    // Novos associados no mês (exclui soft-deleted — repo padrão já filtra deleted_at).
    const newAssociates = await this.repo
      .createQueryBuilder('a')
      .where('a.created_at >= :start', { start: monthStart.toISOString() })
      .andWhere('a.created_at < :end', { end: monthEnd.toISOString() })
      .getCount();

    // Recorrência: assinaturas ACTIVE ÷ associados não-cancelados.
    const activeSubscriptions = await this.subscriptionRepo
      .createQueryBuilder('s')
      .where('s.status = :status', { status: SubscriptionStatus.ACTIVE })
      .getCount();

    const nonCanceledAssociates = await this.repo
      .createQueryBuilder('a')
      .where('a.status != :status', { status: AssociateStatus.CANCELED })
      .getCount();

    const recurrenceRate =
      nonCanceledAssociates > 0 ? activeSubscriptions / nonCanceledAssociates : 0;

    // Churn: canceladas no mês ÷ ativas no início do mês.
    const churnCount = await this.subscriptionRepo
      .createQueryBuilder('s')
      .where('s.canceled_at >= :start', { start: monthStart.toISOString() })
      .andWhere('s.canceled_at < :end', { end: monthEnd.toISOString() })
      .getCount();

    // Ativas no início do mês = ainda não canceladas antes do início + criadas antes do início.
    const activeAtMonthStart = await this.subscriptionRepo
      .createQueryBuilder('s')
      .where('s.created_at < :start', { start: monthStart.toISOString() })
      .andWhere('(s.canceled_at IS NULL OR s.canceled_at >= :start)', {
        start: monthStart.toISOString(),
      })
      .getCount();

    const churnRate = activeAtMonthStart > 0 ? churnCount / activeAtMonthStart : 0;

    // Inadimplência: charges FAILED ou (PENDING vencida) com due_date no mês.
    const delinquentCharges = await this.chargeRepo
      .createQueryBuilder('c')
      .where('c.due_date >= :start', { start: monthStart.toISOString().slice(0, 10) })
      .andWhere('c.due_date < :end', { end: monthEnd.toISOString().slice(0, 10) })
      .andWhere(
        '(c.status = :failed OR (c.status = :pending AND c.due_date < :today))',
        {
          failed: ChargeStatus.FAILED,
          pending: ChargeStatus.PENDING,
          today: new Date().toISOString().slice(0, 10),
        },
      )
      .getCount();

    const pastDueAssociates = await this.repo
      .createQueryBuilder('a')
      .where('a.status = :status', { status: AssociateStatus.PAST_DUE })
      .getCount();

    return {
      expectedGross: currentSeries?.expectedGross ?? 0,
      expectedNet: currentSeries?.expectedNet ?? 0,
      collectedGross: currentSeries?.collectedGross ?? 0,
      collectedNet: currentSeries?.collectedNet ?? 0,
      newAssociates,
      activeSubscriptions,
      recurrenceRate,
      churnCount,
      churnRate,
      delinquentCharges,
      pastDueAssociates,
    };
  }

  async findOne(id: string): Promise<AssociateDetail> {
    const associate = await this.repo.findOne({ where: { id } });
    if (!associate) throw new NotFoundException('Associate not found');

    const subscription = await this.subscriptionRepo.findOne({
      where: { associateId: id },
      order: { createdAt: 'DESC' },
    });
    const charges = await this.chargeRepo.find({
      where: { associateId: id },
      order: { createdAt: 'DESC' },
    });

    return {
      ...this.toView(associate),
      subscription: subscription ? this.toSubscriptionView(subscription) : null,
      charges: charges.map((c) => this.toChargeView(c)),
    };
  }

  async update(id: string, dto: UpdateAssociateDto): Promise<AssociateDto> {
    const associate = await this.repo.findOne({ where: { id } });
    if (!associate) throw new NotFoundException('Associate not found');

    if (dto.name !== undefined) associate.name = dto.name;
    if (dto.whatsapp !== undefined) associate.whatsapp = dto.whatsapp;
    if (dto.email !== undefined) associate.email = dto.email ?? null;
    if (dto.contributionAmount !== undefined) associate.contributionAmount = dto.contributionAmount;
    if (dto.dueDay !== undefined) associate.dueDay = dto.dueDay;

    const saved = await this.repo.save(associate);
    return this.toView(saved);
  }

  async remove(id: string): Promise<void> {
    const associate = await this.repo.findOne({ where: { id } });
    if (!associate) throw new NotFoundException('Associate not found');
    await this.repo.softDelete(id);
  }

  private toView(a: Associate): AssociateDto {
    return {
      id: a.id,
      name: a.name,
      whatsapp: a.whatsapp,
      email: a.email,
      contributionAmount: Number(a.contributionAmount),
      dueDay: a.dueDay,
      status: a.status,
      gatewayCustomerId: a.gatewayCustomerId,
      paymentToken: a.paymentToken,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }

  private toSubscriptionView(s: AssociateSubscription): AssociateSubscriptionDto {
    return {
      id: s.id,
      associateId: s.associateId,
      gatewaySubscriptionId: s.gatewaySubscriptionId,
      netAmount: Number(s.netAmount),
      feeAmount: Number(s.feeAmount),
      grossAmount: Number(s.grossAmount),
      status: s.status,
      startedAt: s.startedAt ? s.startedAt.toISOString() : null,
      canceledAt: s.canceledAt ? s.canceledAt.toISOString() : null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  private toChargeView(c: AssociateCharge): AssociateChargeDto {
    return {
      id: c.id,
      associateId: c.associateId,
      subscriptionId: c.subscriptionId,
      gatewayChargeId: c.gatewayChargeId,
      netAmount: Number(c.netAmount),
      feeAmount: Number(c.feeAmount),
      grossAmount: Number(c.grossAmount),
      status: c.status,
      dueDate: c.dueDate,
      paidAt: c.paidAt ? c.paidAt.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }
}

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AssociatePublicView,
  ChargeStatus,
  SubscribeInput,
  SubscribeResult,
  SubscriptionStatus,
  AssociateSubscription as AssociateSubscriptionDto,
  AssociateCharge as AssociateChargeDto,
} from '@fonte/types';
import { Associate } from './associate.entity';
import { AssociateSubscription } from './associate-subscription.entity';
import { AssociateCharge } from './associate-charge.entity';
import { computeGrossUp } from './gross-up';
import { ABACATEPAY_CLIENT, AbacatePayClient } from './abacatepay/abacatepay.types';

/**
 * Comportamento de pagamento dos endpoints públicos do checkout (story 38).
 * Acesso por `payment_token` (sem JWT). Calcula o gross-up, cria customer +
 * assinatura no gateway e persiste subscription + 1ª cobrança PENDING.
 */
@Injectable()
export class AssociatePaymentService {
  constructor(
    @InjectRepository(Associate)
    private readonly repo: Repository<Associate>,
    @InjectRepository(AssociateSubscription)
    private readonly subscriptionRepo: Repository<AssociateSubscription>,
    @InjectRepository(AssociateCharge)
    private readonly chargeRepo: Repository<AssociateCharge>,
    @Inject(ABACATEPAY_CLIENT)
    private readonly gateway: AbacatePayClient,
    private readonly config: ConfigService,
  ) {}

  /** Taxas de cartão configuráveis por env (default = 3,5% + R$ 0,60 do AbacatePay). */
  private get cardFeePct(): number {
    return Number(this.config.get<string>('ABACATEPAY_CARD_FEE_PCT') ?? '0.035');
  }
  private get cardFeeFixed(): number {
    return Number(this.config.get<string>('ABACATEPAY_CARD_FEE_FIXED') ?? '0.60');
  }

  private async findByToken(token: string): Promise<Associate> {
    const associate = await this.repo.findOne({ where: { paymentToken: token } });
    if (!associate) throw new NotFoundException('Associate not found');
    return associate;
  }

  /** Dados mínimos para pré-preencher a página pública. Não vaza dados sensíveis. */
  async getPublicView(token: string): Promise<AssociatePublicView> {
    const associate = await this.findByToken(token);
    const active = await this.subscriptionRepo.findOne({
      where: { associateId: associate.id, status: SubscriptionStatus.ACTIVE },
    });
    return {
      name: associate.name,
      suggestedAmount: Number(associate.contributionAmount),
      dueDay: associate.dueDay,
      status: associate.status,
      hasActiveSubscription: active !== null,
    };
  }

  async subscribe(token: string, dto: SubscribeInput): Promise<SubscribeResult> {
    const associate = await this.findByToken(token);

    if (dto.contributionAmount <= 0) {
      throw new BadRequestException('contributionAmount must be positive');
    }

    const existingActive = await this.subscriptionRepo.findOne({
      where: { associateId: associate.id, status: SubscriptionStatus.ACTIVE },
    });
    if (existingActive) {
      throw new ConflictException('Associate already has an active subscription');
    }

    const { net, fee, gross } = computeGrossUp(
      dto.contributionAmount,
      this.cardFeePct,
      this.cardFeeFixed,
    );

    // Garante customer no gateway (reusa se já existir).
    let customerId = associate.abacatepayCustomerId;
    if (!customerId) {
      const customer = await this.gateway.createCustomer({
        name: associate.name,
        email: associate.email,
        cellphone: associate.whatsapp,
      });
      customerId = customer.customerId;
      associate.abacatepayCustomerId = customerId;
      await this.repo.save(associate);
    }

    const created = await this.gateway.createSubscription({
      customerId,
      cardToken: dto.cardToken,
      grossAmount: gross,
      dueDay: associate.dueDay,
      externalId: associate.id,
    });

    // Persiste a assinatura (ainda ACTIVE no nosso lado; status final virá do webhook).
    const subscription = await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        associateId: associate.id,
        abacatepaySubscriptionId: created.subscriptionId,
        netAmount: net,
        feeAmount: fee,
        grossAmount: gross,
        status: SubscriptionStatus.ACTIVE,
        startedAt: new Date(),
      }),
    );

    // Primeira cobrança (adesão) fica PENDING até o webhook confirmar o pagamento.
    const charge = await this.chargeRepo.save(
      this.chargeRepo.create({
        associateId: associate.id,
        subscriptionId: subscription.id,
        abacatepayChargeId: created.chargeId,
        netAmount: net,
        feeAmount: fee,
        grossAmount: gross,
        status: ChargeStatus.PENDING,
        dueDate: this.computeDueDate(associate.dueDay),
      }),
    );

    return {
      status: associate.status,
      subscription: this.toSubscriptionView(subscription),
      charge: this.toChargeView(charge),
      checkoutUrl: created.checkoutUrl,
    };
  }

  /** Próxima data de vencimento no formato YYYY-MM-DD, com clamp ao último dia do mês. */
  private computeDueDate(dueDay: number): string {
    const now = new Date();
    const lastDay = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate();
    const day = Math.min(dueDay, lastDay);
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${now.getUTCFullYear()}-${month}-${String(day).padStart(2, '0')}`;
  }

  private toSubscriptionView(s: AssociateSubscription): AssociateSubscriptionDto {
    return {
      id: s.id,
      associateId: s.associateId,
      abacatepaySubscriptionId: s.abacatepaySubscriptionId,
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
      abacatepayChargeId: c.abacatepayChargeId,
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

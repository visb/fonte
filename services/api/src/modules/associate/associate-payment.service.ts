import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AssociateCancelView,
  AssociatePublicView,
  AssociateStatus,
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
import { PAYMENT_GATEWAY, PaymentGateway } from './gateway/gateway.types';

/**
 * Comportamento de pagamento do associado (story 41 — Pagar.me).
 *  - Endpoints públicos do checkout (acesso por `payment_token`, sem JWT): calcula
 *    o gross-up, cria customer + assinatura recorrente no gateway e persiste a
 *    assinatura + 1ª cobrança PENDING.
 *  - Cancelamento da recorrência (acionado pelo admin): cancela no gateway e marca
 *    assinatura/associado como CANCELED.
 *
 * O valor é FIXO (= `contribution_amount` do cadastro) para todas as cobranças.
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
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGateway,
    private readonly config: ConfigService,
  ) {}

  /** Taxas de cartão configuráveis por env (defaults genéricos; ajustar à conta). */
  private get cardFeePct(): number {
    return Number(this.config.get<string>('PAGARME_CARD_FEE_PCT') ?? '0.0399');
  }
  private get cardFeeFixed(): number {
    return Number(this.config.get<string>('PAGARME_CARD_FEE_FIXED') ?? '0.39');
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

  /**
   * Adesão à recorrência. Valor é FIXO (= contribuição do cadastro); o body só
   * traz o `cardToken`. Calcula gross-up, cria assinatura no gateway e persiste
   * assinatura ACTIVE + 1ª cobrança PENDING (status final vem do webhook).
   */
  async subscribe(token: string, dto: SubscribeInput): Promise<SubscribeResult> {
    const associate = await this.findByToken(token);

    const existingActive = await this.subscriptionRepo.findOne({
      where: { associateId: associate.id, status: SubscriptionStatus.ACTIVE },
    });
    if (existingActive) {
      throw new ConflictException('Associate already has an active subscription');
    }

    const { net, fee, gross } = computeGrossUp(
      Number(associate.contributionAmount),
      this.cardFeePct,
      this.cardFeeFixed,
    );

    // Garante customer no gateway (reusa se já existir).
    let customerId = associate.gatewayCustomerId;
    if (!customerId) {
      const customer = await this.gateway.createCustomer({
        name: associate.name,
        email: associate.email,
        phone: associate.whatsapp,
      });
      customerId = customer.customerId;
      associate.gatewayCustomerId = customerId;
      await this.repo.save(associate);
    }

    const created = await this.gateway.createSubscription({
      customerId,
      cardToken: dto.cardToken,
      grossAmount: gross,
      interval: 'month',
      externalId: associate.id,
    });

    const subscription = await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        associateId: associate.id,
        gatewaySubscriptionId: created.subscriptionId,
        netAmount: net,
        feeAmount: fee,
        grossAmount: gross,
        status: SubscriptionStatus.ACTIVE,
        startedAt: new Date(),
      }),
    );

    const charge = await this.chargeRepo.save(
      this.chargeRepo.create({
        associateId: associate.id,
        subscriptionId: subscription.id,
        gatewayChargeId: created.chargeId,
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
      checkoutUrl: null,
    };
  }

  /**
   * Dados mínimos da tela pública de autocancelamento (story 45): nome do
   * associado + se há assinatura ativa/cancelável. Resolve por `payment_token`.
   */
  async getCancelView(token: string): Promise<AssociateCancelView> {
    const associate = await this.findByToken(token);
    const active = await this.subscriptionRepo.findOne({
      where: [
        { associateId: associate.id, status: SubscriptionStatus.ACTIVE },
        { associateId: associate.id, status: SubscriptionStatus.PAST_DUE },
      ],
    });
    return {
      name: associate.name,
      status: associate.status,
      hasActiveSubscription: active !== null,
    };
  }

  /**
   * Autocancelamento público da assinatura (story 45). Resolve o associado por
   * `payment_token` e REUSA a lógica de cancelamento da story 41 (cancela no
   * gateway + assinatura/associado CANCELED). Idempotente: já cancelado → ok,
   * sem chamar o gateway de novo.
   */
  async cancelByToken(token: string): Promise<AssociateCancelView> {
    const associate = await this.findByToken(token);

    const subscription = await this.subscriptionRepo.findOne({
      where: [
        { associateId: associate.id, status: SubscriptionStatus.ACTIVE },
        { associateId: associate.id, status: SubscriptionStatus.PAST_DUE },
      ],
      order: { createdAt: 'DESC' },
    });

    if (subscription) {
      if (subscription.gatewaySubscriptionId) {
        await this.gateway.cancelSubscription(subscription.gatewaySubscriptionId);
      }
      subscription.status = SubscriptionStatus.CANCELED;
      subscription.canceledAt = new Date();
      await this.subscriptionRepo.save(subscription);
    }

    if (associate.status !== AssociateStatus.CANCELED) {
      associate.status = AssociateStatus.CANCELED;
      await this.repo.save(associate);
    }

    return {
      name: associate.name,
      status: AssociateStatus.CANCELED,
      hasActiveSubscription: false,
    };
  }

  /**
   * Cancela a recorrência do associado (acionado pelo admin). Cancela no gateway,
   * marca a assinatura e o associado como CANCELED. Idempotente o suficiente: se
   * não houver assinatura cancelável, 404.
   */
  async cancelSubscription(associateId: string): Promise<AssociateSubscriptionDto> {
    const associate = await this.repo.findOne({ where: { id: associateId } });
    if (!associate) throw new NotFoundException('Associate not found');

    const subscription = await this.subscriptionRepo.findOne({
      where: [
        { associateId, status: SubscriptionStatus.ACTIVE },
        { associateId, status: SubscriptionStatus.PAST_DUE },
      ],
      order: { createdAt: 'DESC' },
    });
    if (!subscription) {
      throw new NotFoundException('No cancelable subscription for this associate');
    }

    if (subscription.gatewaySubscriptionId) {
      await this.gateway.cancelSubscription(subscription.gatewaySubscriptionId);
    }

    subscription.status = SubscriptionStatus.CANCELED;
    subscription.canceledAt = new Date();
    await this.subscriptionRepo.save(subscription);

    associate.status = AssociateStatus.CANCELED;
    await this.repo.save(associate);

    return this.toSubscriptionView(subscription);
  }

  /** Próxima data de vencimento (YYYY-MM-DD), com clamp ao último dia do mês. */
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

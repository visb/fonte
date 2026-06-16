import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AssociateStatus, ChargeStatus, SubscriptionStatus } from '@fonte/types';
import { Associate } from '../associate.entity';
import { AssociateSubscription } from '../associate-subscription.entity';
import { AssociateCharge } from '../associate-charge.entity';

/**
 * Payload de webhook do AbacatePay (formato genérico tolerante: o gateway envia
 * `{ event, data: {...} }`). Mantido frouxo para não acoplar a campos exatos
 * antes da validação em sandbox.
 */
export interface AbacatePayWebhookPayload {
  event?: string;
  data?: {
    id?: string;
    chargeId?: string;
    subscriptionId?: string;
    externalId?: string;
    status?: string;
    amount?: number;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

/**
 * Eventos do AbacatePay (doc oficial) → efeito no nosso domínio.
 *  - subscription.completed / .renewed / checkout.completed → cobrança PAID + assinatura/associado ACTIVE
 *  - charge/payment failed                                  → cobrança FAILED + assinatura/associado PAST_DUE
 *  - subscription.cancelled                                 → assinatura/associado CANCELED
 */
@Injectable()
export class AbacatePayWebhookService {
  private readonly logger = new Logger(AbacatePayWebhookService.name);

  constructor(
    @InjectRepository(Associate)
    private readonly associateRepo: Repository<Associate>,
    @InjectRepository(AssociateSubscription)
    private readonly subscriptionRepo: Repository<AssociateSubscription>,
    @InjectRepository(AssociateCharge)
    private readonly chargeRepo: Repository<AssociateCharge>,
    private readonly config: ConfigService,
  ) {}

  /**
   * Valida o secret do webhook. O AbacatePay entrega o secret configurado como
   * query param `?webhookSecret=...` (padrão da plataforma). Comparação contra
   * `ABACATEPAY_WEBHOOK_SECRET`.
   *
   * TODO(sandbox): confirmar se a v2 usa assinatura HMAC em header em vez de query
   * param e ajustar a verificação (a doc não detalha o mecanismo exato).
   */
  verifySecret(provided: string | undefined): void {
    const expected = this.config.get<string>('ABACATEPAY_WEBHOOK_SECRET');
    if (!expected) {
      throw new UnauthorizedException('Webhook secret not configured');
    }
    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
  }

  /**
   * Processa o evento de forma idempotente por `abacatepay_charge_id`. Webhooks
   * podem repetir; reprocessar um evento já aplicado é no-op.
   */
  async handle(payload: AbacatePayWebhookPayload): Promise<{ processed: boolean }> {
    const event = payload.event ?? '';
    const data = payload.data ?? {};

    if (this.isPaidEvent(event)) {
      return this.markPaid(data);
    }
    if (this.isFailedEvent(event)) {
      return this.markFailed(data);
    }
    if (this.isCanceledEvent(event)) {
      return this.markCanceled(data);
    }

    this.logger.debug(`Ignoring unhandled AbacatePay event: ${event}`);
    return { processed: false };
  }

  private isPaidEvent(event: string): boolean {
    return [
      'subscription.completed',
      'subscription.renewed',
      'checkout.completed',
      'billing.paid',
    ].includes(event);
  }

  private isFailedEvent(event: string): boolean {
    return ['subscription.failed', 'charge.failed', 'billing.failed', 'payment.failed'].includes(
      event,
    );
  }

  private isCanceledEvent(event: string): boolean {
    return ['subscription.cancelled', 'subscription.canceled'].includes(event);
  }

  private async resolveSubscription(
    data: AbacatePayWebhookPayload['data'],
  ): Promise<AssociateSubscription | null> {
    const subId = data?.subscriptionId ?? data?.id;
    if (subId) {
      const byGateway = await this.subscriptionRepo.findOne({
        where: { abacatepaySubscriptionId: subId },
      });
      if (byGateway) return byGateway;
    }
    if (data?.externalId) {
      return this.subscriptionRepo.findOne({
        where: { associateId: data.externalId },
        order: { createdAt: 'DESC' },
      });
    }
    return null;
  }

  /** Cobrança paga → charge PAID + assinatura ACTIVE + associado ACTIVE. Idempotente. */
  private async markPaid(
    data: AbacatePayWebhookPayload['data'],
  ): Promise<{ processed: boolean }> {
    const chargeId = data?.chargeId ?? data?.id ?? null;

    // Idempotência: cobrança já marcada como PAID por esse charge_id → no-op.
    const charge = chargeId
      ? await this.chargeRepo.findOne({ where: { abacatepayChargeId: chargeId } })
      : await this.latestPendingChargeFor(data);

    if (charge) {
      if (charge.status === ChargeStatus.PAID) return { processed: true };
      charge.status = ChargeStatus.PAID;
      charge.paidAt = new Date();
      if (chargeId && !charge.abacatepayChargeId) charge.abacatepayChargeId = chargeId;
      await this.chargeRepo.save(charge);
    }

    const subscription = await this.resolveSubscription(data);
    if (subscription && subscription.status !== SubscriptionStatus.CANCELED) {
      subscription.status = SubscriptionStatus.ACTIVE;
      await this.subscriptionRepo.save(subscription);
      await this.setAssociateStatus(subscription.associateId, AssociateStatus.ACTIVE);
    }
    return { processed: Boolean(charge || subscription) };
  }

  /** Cobrança falhou → charge FAILED + assinatura PAST_DUE + associado PAST_DUE. */
  private async markFailed(
    data: AbacatePayWebhookPayload['data'],
  ): Promise<{ processed: boolean }> {
    const chargeId = data?.chargeId ?? data?.id ?? null;
    const charge = chargeId
      ? await this.chargeRepo.findOne({ where: { abacatepayChargeId: chargeId } })
      : await this.latestPendingChargeFor(data);

    if (charge) {
      if (charge.status === ChargeStatus.FAILED) return { processed: true };
      charge.status = ChargeStatus.FAILED;
      if (chargeId && !charge.abacatepayChargeId) charge.abacatepayChargeId = chargeId;
      await this.chargeRepo.save(charge);
    }

    const subscription = await this.resolveSubscription(data);
    if (subscription && subscription.status !== SubscriptionStatus.CANCELED) {
      subscription.status = SubscriptionStatus.PAST_DUE;
      await this.subscriptionRepo.save(subscription);
      await this.setAssociateStatus(subscription.associateId, AssociateStatus.PAST_DUE);
    }
    return { processed: Boolean(charge || subscription) };
  }

  /** Assinatura cancelada → assinatura CANCELED + associado CANCELED. */
  private async markCanceled(
    data: AbacatePayWebhookPayload['data'],
  ): Promise<{ processed: boolean }> {
    const subscription = await this.resolveSubscription(data);
    if (!subscription) return { processed: false };
    if (subscription.status === SubscriptionStatus.CANCELED) return { processed: true };

    subscription.status = SubscriptionStatus.CANCELED;
    subscription.canceledAt = new Date();
    await this.subscriptionRepo.save(subscription);
    await this.setAssociateStatus(subscription.associateId, AssociateStatus.CANCELED);
    return { processed: true };
  }

  /** Fallback: quando o evento não traz chargeId, pega a cobrança PENDING mais recente. */
  private async latestPendingChargeFor(
    data: AbacatePayWebhookPayload['data'],
  ): Promise<AssociateCharge | null> {
    const subscription = await this.resolveSubscription(data);
    if (!subscription) return null;
    return this.chargeRepo.findOne({
      where: { subscriptionId: subscription.id, status: ChargeStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
  }

  private async setAssociateStatus(associateId: string, status: AssociateStatus): Promise<void> {
    await this.associateRepo.update({ id: associateId, deletedAt: IsNull() }, { status });
  }
}

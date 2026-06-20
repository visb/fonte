import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsNull, Repository } from 'typeorm';
import {
  AssociateStatus,
  ChargeStatus,
  EventPaymentStatus,
  SubscriptionStatus,
} from '@fonte/types';
import { InjectRepository } from '@nestjs/typeorm';
import { Associate } from '../associate.entity';
import { AssociateSubscription } from '../associate-subscription.entity';
import { AssociateCharge } from '../associate-charge.entity';
import { EventRegistration } from '../../event/event-registration.entity';

/**
 * Payload de webhook da Pagar.me v5: `{ type, data: {...} }`.
 * Em eventos de cobrança, `data` é o objeto charge (`data.id` = ch_..., e traz
 * `subscription_id`/`subscription` quando a cobrança é de uma assinatura).
 * Em `subscription.canceled`, `data` é a assinatura (`data.id` = sub_...).
 */
export interface PagarmeWebhookPayload {
  type?: string;
  data?: {
    id?: string;
    status?: string;
    subscription_id?: string;
    code?: string;
    subscription?: { id?: string; code?: string };
    invoice?: { subscription_id?: string; subscription?: { id?: string } };
    metadata?: { associate_id?: string; event_registration_id?: string; origin?: string };
    /** Order que contém a charge (Pagar.me v5). `code` carrega o id da inscrição. */
    order?: { id?: string; code?: string; metadata?: { event_registration_id?: string } };
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

/**
 * Eventos Pagar.me → efeito no domínio:
 *  - charge.paid            → cobrança PAID + assinatura/associado ACTIVE
 *  - charge.payment_failed  → cobrança FAILED + assinatura/associado PAST_DUE
 *  - subscription.canceled  → assinatura/associado CANCELED
 * Idempotente por `gateway_charge_id` (webhooks podem repetir).
 */
@Injectable()
export class PagarmeWebhookService {
  private readonly logger = new Logger(PagarmeWebhookService.name);

  constructor(
    @InjectRepository(Associate)
    private readonly associateRepo: Repository<Associate>,
    @InjectRepository(AssociateSubscription)
    private readonly subscriptionRepo: Repository<AssociateSubscription>,
    @InjectRepository(AssociateCharge)
    private readonly chargeRepo: Repository<AssociateCharge>,
    @InjectRepository(EventRegistration)
    private readonly eventRegistrationRepo: Repository<EventRegistration>,
    private readonly config: ConfigService,
  ) {}

  /**
   * A Pagar.me autentica o webhook por HTTP Basic (usuário/senha configurados no
   * painel). Comparamos o header `Authorization` com o Basic derivado de
   * `PAGARME_WEBHOOK_USER`/`PAGARME_WEBHOOK_PASSWORD`.
   */
  verifyAuth(authHeader: string | undefined): void {
    const user = this.config.get<string>('PAGARME_WEBHOOK_USER');
    const pass = this.config.get<string>('PAGARME_WEBHOOK_PASSWORD');
    if (!user || !pass) {
      throw new UnauthorizedException('Webhook auth not configured');
    }
    const expected = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
    if (!authHeader || authHeader !== expected) {
      throw new UnauthorizedException('Invalid webhook credentials');
    }
  }

  async handle(payload: PagarmeWebhookPayload): Promise<{ processed: boolean }> {
    const type = payload.type ?? '';
    const data = payload.data ?? {};

    // Story 69: charges de order avulsa (evento) primeiro; cai p/ associados se
    // não for de evento. Roteamento por metadata/order.code/charge id.
    if (type === 'charge.paid') {
      const evt = await this.markEventPaid(data);
      if (evt.processed) return evt;
      return this.markPaid(data);
    }
    if (type === 'charge.payment_failed') {
      const evt = await this.markEventFailed(data);
      if (evt.processed) return evt;
      return this.markFailed(data);
    }
    if (type === 'subscription.canceled') return this.markCanceled(data);

    this.logger.debug(`Ignoring unhandled Pagar.me event: ${type}`);
    return { processed: false };
  }

  /** Resolve a inscrição-alvo de uma charge de evento (metadata/code/charge id). */
  private async resolveEventRegistration(
    data: PagarmeWebhookPayload['data'],
  ): Promise<EventRegistration | null> {
    const registrationId =
      data?.metadata?.event_registration_id ??
      data?.order?.metadata?.event_registration_id ??
      data?.order?.code;
    if (registrationId) {
      const byId = await this.eventRegistrationRepo.findOne({
        where: { id: registrationId },
      });
      if (byId) return byId;
    }
    const chargeId = data?.id;
    if (chargeId) {
      return this.eventRegistrationRepo.findOne({
        where: { gatewayChargeId: chargeId },
      });
    }
    return null;
  }

  /** Charge de evento paga → inscrição PAID. Idempotente por charge. */
  private async markEventPaid(
    data: PagarmeWebhookPayload['data'],
  ): Promise<{ processed: boolean }> {
    const registration = await this.resolveEventRegistration(data);
    if (!registration) return { processed: false };
    if (registration.paymentStatus === EventPaymentStatus.PAID) {
      return { processed: true };
    }
    registration.paymentStatus = EventPaymentStatus.PAID;
    if (data?.id && !registration.gatewayChargeId) {
      registration.gatewayChargeId = data.id;
    }
    await this.eventRegistrationRepo.save(registration);
    return { processed: true };
  }

  /** Charge de evento recusada → inscrição FAILED. Idempotente por charge. */
  private async markEventFailed(
    data: PagarmeWebhookPayload['data'],
  ): Promise<{ processed: boolean }> {
    const registration = await this.resolveEventRegistration(data);
    if (!registration) return { processed: false };
    if (registration.paymentStatus === EventPaymentStatus.PAID) {
      // Já pago: não rebaixa.
      return { processed: true };
    }
    if (registration.paymentStatus === EventPaymentStatus.FAILED) {
      return { processed: true };
    }
    registration.paymentStatus = EventPaymentStatus.FAILED;
    if (data?.id && !registration.gatewayChargeId) {
      registration.gatewayChargeId = data.id;
    }
    await this.eventRegistrationRepo.save(registration);
    return { processed: true };
  }

  private subscriptionIdFromCharge(data: PagarmeWebhookPayload['data']): string | undefined {
    return (
      data?.subscription_id ??
      data?.subscription?.id ??
      data?.invoice?.subscription_id ??
      data?.invoice?.subscription?.id
    );
  }

  private associateIdFromData(data: PagarmeWebhookPayload['data']): string | undefined {
    return data?.metadata?.associate_id ?? data?.code;
  }

  private async resolveSubscription(
    data: PagarmeWebhookPayload['data'],
    subId: string | undefined,
  ): Promise<AssociateSubscription | null> {
    if (subId) {
      const byGateway = await this.subscriptionRepo.findOne({
        where: { gatewaySubscriptionId: subId },
      });
      if (byGateway) return byGateway;
    }
    const associateId = this.associateIdFromData(data);
    if (associateId) {
      return this.subscriptionRepo.findOne({
        where: { associateId },
        order: { createdAt: 'DESC' },
      });
    }
    return null;
  }

  /** Cobrança paga → charge PAID + assinatura ACTIVE + associado ACTIVE. Idempotente. */
  private async markPaid(data: PagarmeWebhookPayload['data']): Promise<{ processed: boolean }> {
    const chargeId = data?.id ?? null;
    const subId = this.subscriptionIdFromCharge(data);

    const charge = chargeId
      ? await this.chargeRepo.findOne({ where: { gatewayChargeId: chargeId } })
      : null;
    const target = charge ?? (await this.latestPendingChargeFor(data, subId));

    if (target) {
      if (target.status === ChargeStatus.PAID) return { processed: true };
      target.status = ChargeStatus.PAID;
      target.paidAt = new Date();
      if (chargeId && !target.gatewayChargeId) target.gatewayChargeId = chargeId;
      await this.chargeRepo.save(target);
    }

    const subscription = await this.resolveSubscription(data, subId);
    if (subscription && subscription.status !== SubscriptionStatus.CANCELED) {
      subscription.status = SubscriptionStatus.ACTIVE;
      await this.subscriptionRepo.save(subscription);
      await this.setAssociateStatus(subscription.associateId, AssociateStatus.ACTIVE);
    }
    return { processed: Boolean(target || subscription) };
  }

  /** Cobrança falhou → charge FAILED + assinatura PAST_DUE + associado PAST_DUE. */
  private async markFailed(data: PagarmeWebhookPayload['data']): Promise<{ processed: boolean }> {
    const chargeId = data?.id ?? null;
    const subId = this.subscriptionIdFromCharge(data);

    const charge = chargeId
      ? await this.chargeRepo.findOne({ where: { gatewayChargeId: chargeId } })
      : null;
    const target = charge ?? (await this.latestPendingChargeFor(data, subId));

    if (target) {
      if (target.status === ChargeStatus.FAILED) return { processed: true };
      target.status = ChargeStatus.FAILED;
      if (chargeId && !target.gatewayChargeId) target.gatewayChargeId = chargeId;
      await this.chargeRepo.save(target);
    }

    const subscription = await this.resolveSubscription(data, subId);
    if (subscription && subscription.status !== SubscriptionStatus.CANCELED) {
      subscription.status = SubscriptionStatus.PAST_DUE;
      await this.subscriptionRepo.save(subscription);
      await this.setAssociateStatus(subscription.associateId, AssociateStatus.PAST_DUE);
    }
    return { processed: Boolean(target || subscription) };
  }

  /** Assinatura cancelada → assinatura CANCELED + associado CANCELED. */
  private async markCanceled(data: PagarmeWebhookPayload['data']): Promise<{ processed: boolean }> {
    const subId = data?.id;
    const subscription = await this.resolveSubscription(data, subId);
    if (!subscription) return { processed: false };
    if (subscription.status === SubscriptionStatus.CANCELED) return { processed: true };

    subscription.status = SubscriptionStatus.CANCELED;
    subscription.canceledAt = new Date();
    await this.subscriptionRepo.save(subscription);
    await this.setAssociateStatus(subscription.associateId, AssociateStatus.CANCELED);
    return { processed: true };
  }

  /** Fallback: sem chargeId, pega a cobrança PENDING mais recente da assinatura. */
  private async latestPendingChargeFor(
    data: PagarmeWebhookPayload['data'],
    subId: string | undefined,
  ): Promise<AssociateCharge | null> {
    const subscription = await this.resolveSubscription(data, subId);
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

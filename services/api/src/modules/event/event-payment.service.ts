import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EventPaymentInfo,
  EventPaymentMethod,
  EventPaymentStatus,
  PayEventResult,
} from '@fonte/types';
import {
  PAYMENT_GATEWAY,
  PaymentGateway,
} from '../associate/gateway/gateway.types';
import { Event } from './event.entity';
import { EventRegistration } from './event-registration.entity';
import { PayEventDto } from './dto/pay-event.dto';

/**
 * Pagamento avulso da inscrição em evento (story 69). Endpoints PÚBLICOS,
 * acesso por `payment_token` (sem JWT). Reusa a camada de gateway dos associados
 * (story 41), mas para cobrança ÚNICA (Pagar.me `POST /orders`), não recorrente.
 *
 * Fluxo:
 *  - a inscrição paga nasce `PENDING` com `payment_token` + `amount_cents`
 *    (gross-up) gravados pelo EventRegistrationService;
 *  - `pay` cria a order no gateway (cartão ou PIX) e persiste os ids do gateway;
 *  - o webhook confirma (`PAID`) ou recusa (`FAILED`) — idempotente por charge.
 */
@Injectable()
export class EventPaymentService {
  constructor(
    @InjectRepository(EventRegistration)
    private readonly registrationsRepo: Repository<EventRegistration>,
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGateway,
  ) {}

  private async findByToken(token: string): Promise<EventRegistration> {
    const registration = await this.registrationsRepo.findOne({
      where: { paymentToken: token },
    });
    if (!registration) throw new NotFoundException('Payment not found');
    return registration;
  }

  /** Dados da inscrição p/ a página de pagamento (story 69). 404 token inválido. */
  async getPublicView(token: string): Promise<EventPaymentInfo> {
    const registration = await this.findByToken(token);
    const event = await this.eventsRepo.findOne({
      where: { id: registration.eventId },
    });
    return {
      eventTitle: event?.title ?? '',
      amountCents: registration.amountCents ?? 0,
      paymentStatus: registration.paymentStatus,
      paymentMethod: (registration.paymentMethod as EventPaymentMethod | null) ?? null,
      registrantName: registration.name,
    };
  }

  /**
   * Cria a cobrança avulsa no gateway (cartão ou PIX) e persiste os ids.
   *  - cartão → confirma via webhook (status segue PENDING aqui);
   *  - PIX → devolve QR/copia-e-cola (status PENDING até o webhook confirmar).
   * Idempotente: inscrição já `PAID` → 409 (no-op, não cobra de novo).
   */
  async pay(token: string, dto: PayEventDto): Promise<PayEventResult> {
    const registration = await this.findByToken(token);

    if (registration.paymentStatus === EventPaymentStatus.PAID) {
      throw new ConflictException('Esta inscrição já está paga');
    }
    if (registration.paymentStatus === EventPaymentStatus.NONE) {
      throw new BadRequestException('Inscrição não requer pagamento');
    }
    if (registration.amountCents == null || registration.amountCents <= 0) {
      throw new BadRequestException('Valor de cobrança inválido');
    }
    if (dto.method === 'credit_card' && !dto.cardToken) {
      throw new BadRequestException('cardToken é obrigatório para cartão');
    }

    const event = await this.eventsRepo.findOne({
      where: { id: registration.eventId },
    });

    const order = await this.gateway.createOrder({
      grossAmount: registration.amountCents / 100,
      method: dto.method,
      cardToken: dto.cardToken,
      itemName: `Inscrição — ${event?.title ?? 'Evento'}`,
      externalId: registration.id,
      customer: {
        name: registration.name,
        email: registration.email,
        phone: registration.contact,
      },
    });

    registration.gatewayOrderId = order.orderId;
    registration.gatewayChargeId = order.chargeId;
    registration.paymentMethod = dto.method;
    // Status final vem do webhook; mantém PENDING aqui.
    registration.paymentStatus = EventPaymentStatus.PENDING;
    await this.registrationsRepo.save(registration);

    return {
      paymentStatus: registration.paymentStatus,
      method: dto.method,
      pix:
        dto.method === 'pix'
          ? {
              qrCode: order.pixQrCode,
              qrCodeUrl: order.pixQrCodeUrl,
              expiresAt: order.pixExpiresAt,
            }
          : null,
    };
  }
}

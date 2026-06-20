import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { EventPaymentService } from './event-payment.service';
import { Event } from './event.entity';
import { EventRegistration } from './event-registration.entity';
import { PaymentGateway } from '../associate/gateway/gateway.types';

function makeRegistration(overrides: Partial<EventRegistration> = {}): EventRegistration {
  return {
    id: 'reg-uuid',
    eventId: 'event-uuid',
    name: 'Maria',
    contact: '11999990000',
    email: null,
    answers: {},
    paymentToken: 'tok-1',
    paymentStatus: 'PENDING',
    amountCents: 5248,
    gatewayOrderId: null,
    gatewayChargeId: null,
    paymentMethod: null,
    createdAt: new Date('2026-06-01T12:00:00Z'),
    deletedAt: null,
    ...overrides,
  } as unknown as EventRegistration;
}

function makeGateway(): jest.Mocked<PaymentGateway> {
  return {
    createCustomer: jest.fn(),
    createSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
    createOrder: jest.fn().mockResolvedValue({
      orderId: 'or_1',
      chargeId: 'ch_1',
      status: 'pending',
      pixQrCode: null,
      pixQrCodeUrl: null,
      pixExpiresAt: null,
    }),
  } as unknown as jest.Mocked<PaymentGateway>;
}

function makeService(opts: {
  registration?: EventRegistration | null;
  event?: Event | null;
  gateway?: jest.Mocked<PaymentGateway>;
}) {
  const gateway = opts.gateway ?? makeGateway();
  const saved: EventRegistration[] = [];
  const registrationsRepo = {
    findOne: jest.fn().mockResolvedValue(opts.registration ?? null),
    save: jest.fn((r) => {
      saved.push(r);
      return Promise.resolve(r);
    }),
  } as unknown as Repository<EventRegistration>;
  const eventsRepo = {
    findOne: jest.fn().mockResolvedValue(
      opts.event ?? ({ id: 'event-uuid', title: 'Retiro' } as Event),
    ),
  } as unknown as Repository<Event>;
  const service = new EventPaymentService(registrationsRepo, eventsRepo, gateway);
  return { service, gateway, saved, registrationsRepo };
}

describe('EventPaymentService.getPublicView', () => {
  it('devolve dados da inscrição p/ a página de pagamento', async () => {
    const { service } = makeService({ registration: makeRegistration() });
    const info = await service.getPublicView('tok-1');
    expect(info).toEqual({
      eventTitle: 'Retiro',
      amountCents: 5248,
      paymentStatus: 'PENDING',
      paymentMethod: null,
      registrantName: 'Maria',
    });
  });

  it('404 quando o token é inválido', async () => {
    const { service } = makeService({ registration: null });
    await expect(service.getPublicView('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('EventPaymentService.pay', () => {
  it('cartão: cria a order no gateway e persiste os ids (sem pix)', async () => {
    const { service, gateway, saved } = makeService({ registration: makeRegistration() });
    const result = await service.pay('tok-1', { method: 'credit_card', cardToken: 'card_tok' });

    expect(gateway.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'credit_card',
        cardToken: 'card_tok',
        grossAmount: 52.48,
        externalId: 'reg-uuid',
      }),
    );
    expect(result.method).toBe('credit_card');
    expect(result.pix).toBeNull();
    expect(saved[0].gatewayOrderId).toBe('or_1');
    expect(saved[0].gatewayChargeId).toBe('ch_1');
    expect(saved[0].paymentMethod).toBe('credit_card');
  });

  it('PIX: devolve o QR/copia-e-cola do gateway', async () => {
    const gateway = makeGateway();
    gateway.createOrder.mockResolvedValue({
      orderId: 'or_2',
      chargeId: 'ch_2',
      status: 'pending',
      pixQrCode: '00020126...PIX',
      pixQrCodeUrl: 'https://qr/img.png',
      pixExpiresAt: '2026-06-01T13:00:00Z',
    });
    const { service } = makeService({ registration: makeRegistration(), gateway });

    const result = await service.pay('tok-1', { method: 'pix' });

    expect(gateway.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'pix' }),
    );
    expect(result.pix).toEqual({
      qrCode: '00020126...PIX',
      qrCodeUrl: 'https://qr/img.png',
      expiresAt: '2026-06-01T13:00:00Z',
    });
  });

  it('cartão sem cardToken → 400 (não chama o gateway)', async () => {
    const { service, gateway } = makeService({ registration: makeRegistration() });
    await expect(service.pay('tok-1', { method: 'credit_card' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(gateway.createOrder).not.toHaveBeenCalled();
  });

  it('inscrição já PAID → 409 (idempotente, não cobra de novo)', async () => {
    const { service, gateway } = makeService({
      registration: makeRegistration({ paymentStatus: 'PAID' } as Partial<EventRegistration>),
    });
    await expect(
      service.pay('tok-1', { method: 'pix' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(gateway.createOrder).not.toHaveBeenCalled();
  });

  it('inscrição grátis (NONE) → 400', async () => {
    const { service, gateway } = makeService({
      registration: makeRegistration({ paymentStatus: 'NONE' } as Partial<EventRegistration>),
    });
    await expect(
      service.pay('tok-1', { method: 'pix' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(gateway.createOrder).not.toHaveBeenCalled();
  });

  it('404 quando o token é inválido', async () => {
    const { service } = makeService({ registration: null });
    await expect(
      service.pay('nope', { method: 'pix' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

jest.mock('@fonte/types', () => ({
  AssociateStatus: { PENDING: 'PENDING', ACTIVE: 'ACTIVE', PAST_DUE: 'PAST_DUE', CANCELED: 'CANCELED' },
  SubscriptionStatus: { ACTIVE: 'ACTIVE', PAST_DUE: 'PAST_DUE', CANCELED: 'CANCELED' },
  ChargeStatus: { PENDING: 'PENDING', PAID: 'PAID', FAILED: 'FAILED' },
  EventPaymentStatus: { NONE: 'NONE', PENDING: 'PENDING', PAID: 'PAID', FAILED: 'FAILED' },
  EventAudience: { PUBLIC: 'PUBLIC', INTERNAL: 'INTERNAL' },
}));

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AssociateStatus, ChargeStatus, SubscriptionStatus } from '@fonte/types';
import { PagarmeWebhookService } from './pagarme-webhook.service';
import { Associate } from '../associate.entity';
import { AssociateSubscription } from '../associate-subscription.entity';
import { AssociateCharge } from '../associate-charge.entity';
import { EventRegistration } from '../../event/event-registration.entity';

const WH_USER = 'hookuser';
const WH_PASS = 'hookpass';
const AUTH_OK = `Basic ${Buffer.from(`${WH_USER}:${WH_PASS}`).toString('base64')}`;

function makeConfig(configured = true): ConfigService {
  return {
    get: (key: string) => {
      if (!configured) return undefined;
      if (key === 'PAGARME_WEBHOOK_USER') return WH_USER;
      if (key === 'PAGARME_WEBHOOK_PASSWORD') return WH_PASS;
      return undefined;
    },
  } as unknown as ConfigService;
}

function makeService(opts: {
  charge?: AssociateCharge | null;
  subscription?: AssociateSubscription | null;
  eventRegistration?: EventRegistration | null;
  configured?: boolean;
}) {
  const associateUpdates: Array<{ id: unknown; status: AssociateStatus }> = [];

  const associateRepo = {
    update: jest.fn((where: { id: string }, patch: { status: AssociateStatus }) => {
      associateUpdates.push({ id: where.id, status: patch.status });
      return Promise.resolve();
    }),
  } as unknown as Repository<Associate>;

  const subscriptionRepo = {
    findOne: jest.fn().mockResolvedValue(opts.subscription ?? null),
    save: jest.fn((s) => Promise.resolve(s)),
  } as unknown as Repository<AssociateSubscription>;

  const chargeRepo = {
    findOne: jest.fn().mockResolvedValue(opts.charge ?? null),
    save: jest.fn((c) => Promise.resolve(c)),
  } as unknown as Repository<AssociateCharge>;

  const eventRegistrationRepo = {
    findOne: jest.fn().mockResolvedValue(opts.eventRegistration ?? null),
    save: jest.fn((r) => Promise.resolve(r)),
  } as unknown as Repository<EventRegistration>;

  const service = new PagarmeWebhookService(
    associateRepo,
    subscriptionRepo,
    chargeRepo,
    eventRegistrationRepo,
    makeConfig(opts.configured ?? true),
  );
  return { service, subscriptionRepo, chargeRepo, eventRegistrationRepo, associateUpdates };
}

describe('PagarmeWebhookService', () => {
  describe('verifyAuth', () => {
    it('passes with the correct Basic credentials', () => {
      const { service } = makeService({});
      expect(() => service.verifyAuth(AUTH_OK)).not.toThrow();
    });

    it('rejects wrong credentials', () => {
      const { service } = makeService({});
      expect(() => service.verifyAuth('Basic wrong')).toThrow(UnauthorizedException);
    });

    it('rejects when not configured', () => {
      const { service } = makeService({ configured: false });
      expect(() => service.verifyAuth(AUTH_OK)).toThrow(UnauthorizedException);
    });
  });

  describe('handle', () => {
    it('charge.paid → charge PAID + subscription/associate ACTIVE', async () => {
      const charge = {
        id: 'c1',
        status: ChargeStatus.PENDING,
        gatewayChargeId: 'ch_1',
      } as AssociateCharge;
      const subscription = {
        id: 's1',
        associateId: 'a1',
        gatewaySubscriptionId: 'sub_1',
        status: SubscriptionStatus.ACTIVE,
      } as AssociateSubscription;
      const { service, chargeRepo, subscriptionRepo, associateUpdates } = makeService({
        charge,
        subscription,
      });

      const res = await service.handle({
        type: 'charge.paid',
        data: { id: 'ch_1', subscription_id: 'sub_1' },
      });

      expect(res.processed).toBe(true);
      expect((chargeRepo.save as jest.Mock).mock.calls[0][0].status).toBe(ChargeStatus.PAID);
      expect((subscriptionRepo.save as jest.Mock).mock.calls[0][0].status).toBe(
        SubscriptionStatus.ACTIVE,
      );
      expect(associateUpdates[0]).toEqual({ id: 'a1', status: AssociateStatus.ACTIVE });
    });

    it('charge.paid is idempotent (already PAID → no re-save)', async () => {
      const charge = { id: 'c1', status: ChargeStatus.PAID, gatewayChargeId: 'ch_1' } as AssociateCharge;
      const { service, chargeRepo } = makeService({ charge, subscription: null });
      const res = await service.handle({ type: 'charge.paid', data: { id: 'ch_1' } });
      expect(res.processed).toBe(true);
      expect(chargeRepo.save as jest.Mock).not.toHaveBeenCalled();
    });

    it('charge.payment_failed → charge FAILED + subscription/associate PAST_DUE', async () => {
      const charge = { id: 'c1', status: ChargeStatus.PENDING, gatewayChargeId: 'ch_1' } as AssociateCharge;
      const subscription = {
        id: 's1',
        associateId: 'a1',
        gatewaySubscriptionId: 'sub_1',
        status: SubscriptionStatus.ACTIVE,
      } as AssociateSubscription;
      const { service, chargeRepo, associateUpdates } = makeService({ charge, subscription });

      const res = await service.handle({
        type: 'charge.payment_failed',
        data: { id: 'ch_1', subscription_id: 'sub_1' },
      });

      expect(res.processed).toBe(true);
      expect((chargeRepo.save as jest.Mock).mock.calls[0][0].status).toBe(ChargeStatus.FAILED);
      expect(associateUpdates[0]).toEqual({ id: 'a1', status: AssociateStatus.PAST_DUE });
    });

    it('subscription.canceled → subscription/associate CANCELED', async () => {
      const subscription = {
        id: 's1',
        associateId: 'a1',
        gatewaySubscriptionId: 'sub_1',
        status: SubscriptionStatus.ACTIVE,
      } as AssociateSubscription;
      const { service, subscriptionRepo, associateUpdates } = makeService({ subscription });

      const res = await service.handle({ type: 'subscription.canceled', data: { id: 'sub_1' } });

      expect(res.processed).toBe(true);
      expect((subscriptionRepo.save as jest.Mock).mock.calls[0][0].status).toBe(
        SubscriptionStatus.CANCELED,
      );
      expect(associateUpdates[0]).toEqual({ id: 'a1', status: AssociateStatus.CANCELED });
    });

    it('ignores unhandled events', async () => {
      const { service } = makeService({});
      const res = await service.handle({ type: 'order.created', data: {} });
      expect(res.processed).toBe(false);
    });

    // ── Charges de evento (story 69) ──────────────────────────────────────────

    it('charge.paid de evento (metadata) → inscrição PAID, sem tocar associado', async () => {
      const eventRegistration = {
        id: 'reg-1',
        paymentStatus: 'PENDING',
        gatewayChargeId: null,
      } as unknown as EventRegistration;
      const { service, eventRegistrationRepo, chargeRepo } = makeService({ eventRegistration });

      const res = await service.handle({
        type: 'charge.paid',
        data: { id: 'ch_evt', metadata: { origin: 'event', event_registration_id: 'reg-1' } },
      });

      expect(res.processed).toBe(true);
      expect((eventRegistrationRepo.save as jest.Mock).mock.calls[0][0].paymentStatus).toBe('PAID');
      // Não roteou para o fluxo de associado.
      expect(chargeRepo.save as jest.Mock).not.toHaveBeenCalled();
    });

    it('charge.paid de evento por order.code resolve a inscrição', async () => {
      const eventRegistration = {
        id: 'reg-2',
        paymentStatus: 'PENDING',
        gatewayChargeId: null,
      } as unknown as EventRegistration;
      const { service, eventRegistrationRepo } = makeService({ eventRegistration });

      const res = await service.handle({
        type: 'charge.paid',
        data: { id: 'ch_x', order: { id: 'or_1', code: 'reg-2' } },
      });

      expect(res.processed).toBe(true);
      expect((eventRegistrationRepo.save as jest.Mock).mock.calls[0][0].paymentStatus).toBe('PAID');
    });

    it('charge.paid de evento é idempotente (já PAID → no re-save)', async () => {
      const eventRegistration = {
        id: 'reg-3',
        paymentStatus: 'PAID',
        gatewayChargeId: 'ch_3',
      } as unknown as EventRegistration;
      const { service, eventRegistrationRepo } = makeService({ eventRegistration });

      const res = await service.handle({
        type: 'charge.paid',
        data: { id: 'ch_3', metadata: { event_registration_id: 'reg-3' } },
      });

      expect(res.processed).toBe(true);
      expect(eventRegistrationRepo.save as jest.Mock).not.toHaveBeenCalled();
    });

    it('charge.payment_failed de evento → inscrição FAILED', async () => {
      const eventRegistration = {
        id: 'reg-4',
        paymentStatus: 'PENDING',
        gatewayChargeId: null,
      } as unknown as EventRegistration;
      const { service, eventRegistrationRepo } = makeService({ eventRegistration });

      const res = await service.handle({
        type: 'charge.payment_failed',
        data: { id: 'ch_4', metadata: { event_registration_id: 'reg-4' } },
      });

      expect(res.processed).toBe(true);
      expect((eventRegistrationRepo.save as jest.Mock).mock.calls[0][0].paymentStatus).toBe(
        'FAILED',
      );
    });
  });
});
